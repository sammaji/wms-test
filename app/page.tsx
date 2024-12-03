import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"

type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: {
    item: true;
    fromLocation: true;
    toLocation: true;
  }
}>

async function getStats() {
  const [totalItems, totalLocations, totalStock] = await Promise.all([
    prisma.item.count(),
    prisma.location.count(),
    prisma.stock.aggregate({
      _sum: {
        quantity: true
      }
    })
  ])

  return {
    totalItems,
    totalLocations,
    totalStock: totalStock._sum.quantity || 0
  }
}

async function getRecentTransactions() {
  return prisma.transaction.findMany({
    take: 5,
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      item: true,
      fromLocation: true,
      toLocation: true
    }
  }) as Promise<TransactionWithRelations[]>
}

export default async function Home() {
  const stats = await getStats()
  const recentTransactions = await getRecentTransactions()

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{stats.totalItems}</div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{stats.totalLocations}</div>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{stats.totalStock}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 last:border-0 last:pb-0 gap-2"
              >
                <div>
                  <p className="font-medium line-clamp-1">{transaction.item.name}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {transaction.type === 'ADD' && `Added ${transaction.quantity} to ${transaction.toLocation?.label}`}
                    {transaction.type === 'REMOVE' && `Removed ${transaction.quantity} from ${transaction.fromLocation?.label}`}
                    {transaction.type === 'MOVE' && `Moved ${transaction.quantity} from ${transaction.fromLocation?.label} to ${transaction.toLocation?.label}`}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(transaction.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 