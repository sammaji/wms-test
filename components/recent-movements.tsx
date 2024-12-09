import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TransactionType } from "@prisma/client"
import { prisma } from "@/lib/db"

interface Movement {
  id: string
  type: TransactionType
  quantity: number
  createdAt: string
  item: {
    sku: string
    name: string
  }
  fromLocation?: {
    label: string
  }
  toLocation?: {
    label: string
  }
}

function MovementListItem({ movement }: { movement: Movement }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 last:border-0 last:pb-0 gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">
            {movement.type === TransactionType.MOVE ? (
              <>
                {movement.fromLocation?.label} → {movement.toLocation?.label}
              </>
            ) : movement.type === TransactionType.ADD ? (
              <>Added to {movement.toLocation?.label}</>
            ) : (
              <>Removed from {movement.fromLocation?.label}</>
            )}
          </p>
          <Badge variant={
            movement.type === TransactionType.MOVE ? "secondary" :
            movement.type === TransactionType.ADD ? "success" : "destructive"
          }>
            {movement.type}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {movement.quantity}x {movement.item.sku} - {movement.item.name}
        </div>
      </div>
      <div className="text-sm text-muted-foreground">
        {new Date(movement.createdAt).toLocaleDateString()}
      </div>
    </div>
  )
}

async function retryOperation<T>(operation: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error: any) {
      if (attempt === maxAttempts || !error.message?.includes('Server has closed the connection')) {
        throw error
      }
      console.log(`Attempt ${attempt} failed, retrying in ${attempt} seconds...`)
      await new Promise(resolve => setTimeout(resolve, attempt * 1000))
    }
  }
  throw new Error('Failed after max attempts')
}

async function getMovements() {
  try {
    // Ensure connection is alive
    await prisma.$connect()
    
    return await retryOperation(() => 
      prisma.transaction.findMany({
        take: 10,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          item: {
            include: {
              company: true
            }
          }
        }
      })
    )
  } catch (error) {
    console.error('Failed to fetch movements:', error)
    return [] // Return empty array if there's an error
  }
}

export async function RecentMovements() {
  const movements = await getMovements()

  if (!movements.length) {
    return (
      <div className="space-y-4">
        <div className="text-xl font-semibold">Recent Movements</div>
        <div className="text-sm text-gray-500">No recent movements</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-xl font-semibold">Recent Movements</div>
      <div className="grid gap-4">
        {movements.map((movement) => (
          <div
            key={movement.id}
            className="flex flex-col gap-2 p-4 border rounded-lg bg-white shadow-sm"
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium">
                  {movement.item.company.code} - {movement.item.sku}
                </div>
                <div className="text-sm text-gray-500">
                  {movement.item.name}
                </div>
              </div>
              <div className="text-sm text-gray-500">
                Qty: {movement.quantity}
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {movement.type === 'PUTAWAY' ? 'Putaway to' : 'Removed from'}{' '}
              {movement.bayCode}
            </div>
            <div className="text-xs text-gray-400">
              {new Date(movement.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 