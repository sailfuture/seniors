import { LifeMapGate } from "@/components/life-map-gate"

export default function LifeMapLayout({ children }: { children: React.ReactNode }) {
  return <LifeMapGate>{children}</LifeMapGate>
}
