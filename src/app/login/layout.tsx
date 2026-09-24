import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Нэвтрэх",
};

export default function LoginLayout({ children }: LayoutProps<"/login">) {
  return children;
}
