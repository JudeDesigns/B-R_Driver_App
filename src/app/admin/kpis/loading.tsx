import { AuthLoadingSpinner } from "@/hooks/useAuth";

export default function Loading() {
  return <AuthLoadingSpinner message="Loading KPIs..." />;
}
