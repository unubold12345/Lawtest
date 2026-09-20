import BrowsePage from "@/components/BrowsePage";

export const revalidate = 5;

// unanswered pool: questions without an official answer — users may save their own
export default function Page() {
  return <BrowsePage pool="unanswered" />;
}
