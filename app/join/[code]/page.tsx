import { JoinGroupForm } from "@/components/groups/join-group-form";

type Props = {
  params: Promise<{
    code: string;
  }>;
};

export default async function JoinPage({ params }: Props) {
  const { code } = await params;
  return <JoinGroupForm code={code} />;
}
