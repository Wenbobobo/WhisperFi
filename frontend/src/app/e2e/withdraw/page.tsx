import WithdrawCard from "../../../components/WithdrawCard";

export const dynamic = "force-dynamic";

export default function WithdrawE2EPage() {
  return (
    <main style={{ padding: "2rem", minHeight: "100vh", background: "#050505" }}>
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        <WithdrawCard />
      </div>
    </main>
  );
}
