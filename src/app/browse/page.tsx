import type { Metadata } from "next";
import BrowsePage from "@/components/BrowsePage";

export const revalidate = 5;

export const metadata: Metadata = {
  title: "Бүх сорилго",
  description: "Хариулттай бүх сорилго — үндсэн болон дэд ангиллаар шүүж үзэх, хайх.",
};

// answered pool: questions that have an official answer in the data files
export default function Page() {
  return <BrowsePage pool="answered" />;
}
