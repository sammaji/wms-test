import axios from "axios";

export type StockHistory = {
  id: string;
  date: string;
  type: "ADD" | "REMOVE" | "MOVE";
  quantity: number;
  sku: string;
  itemName: string;
  fromLocation: string;
  toLocation: string;
  user: string;
};

export type StockHistoryResponse = {
  data: StockHistory[];
};

export const getStockHistory = async () => {
  const res = await axios.get("/api/transactions");
  return res;
};
