import type { Metadata } from "next";
import BrowsePage from "@/components/BrowsePage";

export const revalidate = 5;

export const metadata: Metadata = {
  title: "Хариултгүй сорилго",
  description: "Албан ёсны хариултгүй сорилгууд — өөрийн хариултыг хадгаж, шалгах.",
};

// unanswered pool: questions without an official answer — users may save their own
export default function Page() {
  return <BrowsePage pool="unanswered" />;
}
