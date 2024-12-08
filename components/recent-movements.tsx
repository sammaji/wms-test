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

async function getMovements() {
  const movements = await prisma.transaction.findMany({
    take: 10,
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      item: {
        select: {
          sku: true,
          name: true
        }
      },
      fromLocation: {
        select: {
          label: true
        }
      },
      toLocation: {
        select: {
          label: true
        }
      }
    }
  })

  return movements.map((movement: any) => ({
    ...movement,
    createdAt: movement.createdAt.toISOString()
  }))
}

export async function RecentMovements() {
  const movements = await getMovements()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Movements</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {movements.map((movement: Movement) => (
          <MovementListItem key={movement.id} movement={movement} />
        ))}
      </CardContent>
    </Card>
  )
} 