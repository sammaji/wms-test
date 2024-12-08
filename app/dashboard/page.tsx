import { PutawayBatchList } from "@/components/putaway-batch-list"
import { prisma } from "@/lib/db"
import { Package2, MapPin, BarChart3, ArrowUpDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function DashboardPage() {
  // Get statistics
  const [itemCount, locationCount, stockCount, recentBatches] = await Promise.all([
    prisma.item.count(),
    prisma.location.count(),
    prisma.stock.count(),
    prisma.putawayBatch.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        location: true,
        transactions: {
          include: {
            item: true,
            toLocation: true
          }
        }
      }
    })
  ])

  // Calculate total stock quantity
  const totalStock = await prisma.stock.aggregate({
    _sum: {
      quantity: true
    }
  })

  return (
    <div className="container max-w-7xl py-6">
      <div className="space-y-8">
        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{itemCount}</div>
              <p className="text-xs text-muted-foreground">Unique SKUs in system</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{locationCount}</div>
              <p className="text-xs text-muted-foreground">Storage locations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Records</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stockCount}</div>
              <p className="text-xs text-muted-foreground">Item-location pairs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStock._sum.quantity || 0}</div>
              <p className="text-xs text-muted-foreground">Total quantity in stock</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Putaways */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Recent Putaways</h2>
            <p className="text-sm text-muted-foreground">View and manage recent putaway operations</p>
          </div>
          <PutawayBatchList batches={recentBatches} />
        </div>
      </div>
    </div>
  )
} 