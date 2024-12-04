import { prisma } from "@/lib/db"
import { SKUTable } from "@/components/sku-table"

export default async function SKUPage() {
  const [items, companies] = await Promise.all([
    prisma.item.findMany({
      include: {
        company: {
          select: {
            id: true,
            code: true
          }
        }
      },
      orderBy: {
        sku: 'asc'
      }
    }),
    prisma.company.findMany({
      select: {
        id: true,
        code: true
      },
      orderBy: {
        code: 'asc'
      }
    })
  ])

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">SKU Management</h1>
      <SKUTable items={items} companies={companies} />
    </div>
  )
} 