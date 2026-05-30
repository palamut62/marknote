import logoUrl from "@/assets/brand/marka-app-icon.png";

type LogoProps = {
  size?: number;
  title?: string;
};

export function Logo({ size = 22, title = "marknote" }: LogoProps) {
  return (
    <img
      src={logoUrl}
      width={size}
      height={size}
      alt={title}
      draggable={false}
      style={{ display: "block", userSelect: "none" }}
    />
  );
}
