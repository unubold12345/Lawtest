import BrowsePage from "@/components/BrowsePage";

export const revalidate = 5;

// answered pool: questions that have an official answer in the data files
export default function Page() {
  return <BrowsePage pool="answered" />;
}
