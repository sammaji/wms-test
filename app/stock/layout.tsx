export default function StockLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="container max-w-xl py-6">
      {children}
    </div>
  )
} 