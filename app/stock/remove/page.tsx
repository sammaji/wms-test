import { prisma } from "@/lib/db"
import { RemoveStockForm } from "@/components/remove-stock-form"

export default function RemoveStockPage() {
  return (
    <div className="container max-w-xl">
      <h1 className="text-2xl font-bold mb-4">Remove Stock</h1>
      <RemoveStockForm />
    </div>
  )
} 