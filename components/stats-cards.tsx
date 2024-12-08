import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { prisma } from "@/lib/db"

async function getStats() {
  const [
    itemCount,
    locationCount,
    stockCount,
    totalQuantity,
  ] = await Promise.all([
    prisma.item.count(),
    prisma.location.count(),
    prisma.stock.count(),
    prisma.stock.aggregate({
      _sum: {
        quantity: true
      }
    })
  ])

  return {
    itemCount,
    locationCount,
    stockCount,
    totalQuantity: totalQuantity._sum.quantity || 0
  }
}

export async function StatsCards() {
  const stats = await getStats()

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.itemCount}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.locationCount}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Stock Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.stockCount}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalQuantity}</div>
        </CardContent>
      </Card>
    </div>
  )
} 