"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Company {
  id: string
  code: string
}

export default function SettingsPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [code, setCode] = useState("")

  // Debug logging for state changes
  useEffect(() => {
    console.log("[SETTINGS] State changed:", {
      companies,
      isLoading,
      isDialogOpen,
      isSubmitting,
      editingCompany,
      code
    })
  }, [companies, isLoading, isDialogOpen, isSubmitting, editingCompany, code])

  // Fetch companies
  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    console.log("[SETTINGS] Fetching companies")
    try {
      const response = await fetch("/api/companies")
      if (!response.ok) throw new Error("Failed to fetch companies")
      const data = await response.json()
      console.log("[SETTINGS] Companies fetched:", data)
      setCompanies(data)
    } catch (error) {
      console.error("[SETTINGS] Error fetching companies:", error)
      toast({
        title: "Error",
        description: "Failed to load companies",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("[SETTINGS] Form submitted with code:", code)
    
    if (!code.trim()) {
      console.log("[SETTINGS] Empty code, showing error")
      toast({
        title: "Error",
        description: "Company code is required",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      console.log("[SETTINGS] Sending request:", {
        method: editingCompany ? "PUT" : "POST",
        url: "/api/companies" + (editingCompany ? `/${editingCompany.id}` : ""),
        body: { code }
      })

      const response = await fetch("/api/companies" + (editingCompany ? `/${editingCompany.id}` : ""), {
        method: editingCompany ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      })

      const responseText = await response.text()
      console.log("[SETTINGS] Response:", {
        status: response.status,
        text: responseText
      })

      if (!response.ok) {
        throw new Error(responseText || "Failed to save company")
      }

      await fetchCompanies()
      setIsDialogOpen(false)
      setCode("")
      setEditingCompany(null)
      
      toast({
        title: "Success",
        description: `Company ${editingCompany ? "updated" : "created"} successfully`,
      })
    } catch (error) {
      console.error("[SETTINGS] Error saving company:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save company",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (company: Company) => {
    setEditingCompany(company)
    setCode(company.code)
    setIsDialogOpen(true)
  }

  const handleDelete = async (company: Company) => {
    if (!confirm(`Are you sure you want to delete ${company.code}?`)) return

    try {
      const response = await fetch(`/api/companies/${company.id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete company")

      await fetchCompanies()
      toast({
        title: "Success",
        description: "Company deleted successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete company",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="space-y-6">
        <div className="bg-card rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Companies</h2>
            <Button onClick={() => {
              setEditingCompany(null)
              setCode("")
              setIsDialogOpen(true)
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Company
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>{company.code}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(company)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(company)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCompany ? "Edit" : "Add"} Company</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Company Code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Enter company code"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editingCompany ? "Updating..." : "Adding..."}
                  </>
                ) : (
                  editingCompany ? "Update" : "Add"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
} 