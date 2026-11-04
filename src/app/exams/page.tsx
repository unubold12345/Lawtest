import ExamCatalog from "@/components/ExamCatalog";

export const metadata = { title: "Шалгалтын сан" };
export const revalidate = 300;
export default function ExamsPage() { return <ExamCatalog />; }
