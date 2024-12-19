import { StockHistoryResponse, getStockHistory } from "@/lib/query";
import { useQuery } from "@tanstack/react-query";
import React from "react";

export default function Page() {
    const historyQuery = useQuery<StockHistoryResponse>({
        queryKey: ["history"],
        queryFn: getStockHistory
    })

    if (historyQuery.isLoading) return <p>loading...</p>
    if (historyQuery.isError) return <p>error...</p>

    // for type safety
    if (!historyQuery.data) return;

    const { data: historyData } = historyQuery.data

    return (
        <div>
            {historyData.map((history, index) => {
                return (
                    <React.Fragment key={index}>
                        <div>
                            <p>{history.type}</p>
                            <p>{history.sku}</p>
                            <p>{history.type}</p>
                            <p>{history.quantity}</p>
                        </div>
                    </React.Fragment>
                )
            })}
        </div>
    )
}
