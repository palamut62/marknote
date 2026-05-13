import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, FolderOpen, Sparkles } from "lucide-react";
import { Button, Icon, Kbd, Overlay } from "@/components/primitives";
import writeUrl from "@/assets/mascot/write.png";
import notebookUrl from "@/assets/mascot/notebook.png";
import penUrl from "@/assets/mascot/pen.png";
import inspectUrl from "@/assets/mascot/inspect.png";
import exciteUrl from "@/assets/mascot/excite.png";

type WelcomeOverlayProps = {
  open: boolean;
  onClose: () => void;
  onOpenFolder: () => void;
};

type Slide = {
  mascot: string;
  title: string;
  body: ReactNode;
};

const SLIDES: Slide[] = [
  {
    mascot: writeUrl,
    title: "welcome to marka.md",
    body: (
      <>a local markdown editor — built for the notes you share with ai.</>
    ),
  },
  {
    mascot: notebookUrl,
    title: "open your notes",
    body: (
      <>
        press <Kbd>⌘</Kbd><Kbd>⇧</Kbd><Kbd>O</Kbd> to load a folder of <code>.md</code> files. the tree shows up on the left.
      </>
    ),
  },
  {
    mascot: penUrl,
    title: "edit & live preview",
    body: (
      <>
        type on the left. preview renders on the right. <Kbd>⌘</Kbd><Kbd>S</Kbd> to save.
      </>
    ),
  },
  {
    mascot: inspectUrl,
    title: "bundle for claude",
    body: (
      <>
        hover any <code>.md</code> in the tree, tick its checkbox, press{" "}
        <Kbd>⌘</Kbd><Kbd>⇧</Kbd><Kbd>C</Kbd> — your selection becomes one prompt blob, ready to paste.
      </>
    ),
  },
  {
    mascot: exciteUrl,
    title: "you're set",
    body: (
      <>
        press <Kbd>⌘</Kbd><Kbd>K</Kbd> any time for the command palette. <Kbd>⌘</Kbd><Kbd>/</Kbd> for help. happy writing.
      </>
    ),
  },
];

export function WelcomeOverlay({ open, onClose, onOpenFolder }: WelcomeOverlayProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setStep((s) => Math.min(SLIDES.length - 1, s + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setStep((s) => Math.max(0, s - 1));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const slide = SLIDES[step];
  const isFirst = step === 0;
  const isLast = step === SLIDES.length - 1;

  const next = () => setStep((s) => Math.min(SLIDES.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  return (
    <Overlay open={open} onClose={onClose} ariaLabel="welcome to marka.md" variant="modal">
      <div className="mdv-welcome">
        <div className="mdv-welcome__slide" key={step}>
          <img
            src={slide.mascot}
            alt=""
            aria-hidden
            width={140}
            height={140}
            draggable={false}
            className="mdv-welcome__art"
          />
          <h1 className="mdv-welcome__title">{slide.title}</h1>
          <p className="mdv-welcome__body">{slide.body}</p>
        </div>

        <div className="mdv-welcome__dots" aria-hidden>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`mdv-welcome__dot${i === step ? " is-active" : ""}`}
              onClick={() => setStep(i)}
              aria-label={`step ${i + 1}`}
            />
          ))}
        </div>

        <div className="mdv-welcome__actions">
          {!isFirst ? (
            <Button
              onClick={prev}
              icon={<Icon icon={ChevronLeft} size={14} strokeWidth={1.75} />}
            >
              back
            </Button>
          ) : (
            <Button onClick={onClose}>skip</Button>
          )}
          {isLast ? (
            <>
              <Button onClick={onClose}>
                <Icon icon={Sparkles} size={14} strokeWidth={1.75} />
                explore the demo
              </Button>
              <Button
                variant="solid"
                onClick={() => {
                  onClose();
                  void onOpenFolder();
                }}
                icon={<Icon icon={FolderOpen} size={14} strokeWidth={1.75} />}
              >
                open a folder
              </Button>
            </>
          ) : (
            <Button
              variant="solid"
              onClick={next}
            >
              next
              <Icon icon={ChevronRight} size={14} strokeWidth={1.75} />
            </Button>
          )}
        </div>

        <div className="mdv-welcome__hint">
          <Kbd>←</Kbd> <Kbd>→</Kbd> to navigate · <Kbd>esc</Kbd> to close
        </div>
      </div>
    </Overlay>
  );
}
