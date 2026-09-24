import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Нууц үг тохируулах",
  robots: { index: false, follow: false },
};

export default function SetPasswordLayout({ children }: LayoutProps<"/set-password">) {
  return children;
}
