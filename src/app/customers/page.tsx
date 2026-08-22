
"use client"

import * as React from "react"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { Search, UserPlus, MoreVertical, Edit2, Trash2, Loader2 } from "lucide-react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, serverTimestamp, setDoc, doc, limit, getDocs, deleteDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function CustomersPage() {
  const db = useFirestore()
  const { toast } = useToast()
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const brandColor = config?.brandColor || "#FF3399"

  const [searchQuery, setSearchQuery] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [newCustomer, setNewCustomer] = React.useState({ name: "", phone: "", location: "" })

  const customersRef = React.useMemo(() => 
    db ? query(collection(db, "customers"), orderBy("id", "asc")) : null
  , [db])
  const { data: customers = [], loading } = useCollection(customersRef)

  const filteredCustomers = React.useMemo(() => {
    const q = searchQuery.toLowerCase()
    return customers.filter(c => c.name?.toLowerCase().includes(q) || c.id?.toLowerCase().includes(q))
  }, [customers, searchQuery])

  const handleRegister = async () => {
    if (!db || !newCustomer.name) return
    setSaving(true)
    try {
      const q = query(collection(db, "customers"), orderBy("id", "desc"), limit(1))
      const snap = await getDocs(q)
      let nextId = "CL-001"
      if (!snap.empty) {
        const lastId = snap.docs[0].id
        const lastNum = parseInt(lastId.split('-')[1]) || 0
        nextId = `CL-${(lastNum + 1).toString().padStart(3, '0')}`
      }
      await setDoc(doc(db, "customers", nextId), { id: nextId, name: newCustomer.name.toUpperCase(), phone: newCustomer.phone, location: newCustomer.location, createdAt: serverTimestamp() })
      toast({ title: "Cliente Registrado" })
      setIsDialogOpen(false)
      setNewCustomer({ name: "", phone: "", location: "" })
    } catch (e) { toast({ variant: "destructive", title: "Error" }) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-6 pt-2 pb-24 px-2 md:px-0 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-black pb-4">
        <div>
          <h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">Cartera de Clientes</h1>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] ml-1 mt-1">Gestión Industrial</p>
        </div>
        <div className="flex w-full md:w-auto gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4" style={{ color: brandColor }} />
            <Input 
              placeholder="BUSCAR CLIENTE..." 
              className="pl-10 h-11 rounded-xl border-black/10 font-black text-xs uppercase"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 bg-black text-white font-black rounded-xl px-6 shadow-lg">
                <UserPlus className="w-4 h-4 mr-2" /> NUEVO
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] border-none shadow-2xl max-w-md">
              <DialogHeader><DialogTitle className="text-sm font-black text-black uppercase tracking-widest">Alta de Cliente</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-1"><Label className="text-[9px] font-black uppercase text-black ml-1">Nombre Completo *</Label><Input value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} className="h-10 text-xs font-black uppercase rounded-xl" /></div>
                <Button className="w-full h-12 bg-black text-white font-black rounded-xl mt-2" onClick={handleRegister} disabled={saving || !newCustomer.name}>{saving ? <Loader2 className="animate-spin" /> : "REGISTRAR CLIENTE"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="rounded-[2rem] border shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-black/5 hover:bg-black/5 border-none h-10">
              <TableHead className="font-black text-[9px] uppercase text-black pl-8 w-24">ID</TableHead>
              <TableHead className="font-black text-[9px] uppercase text-black">Cliente</TableHead>
              <TableHead className="text-right pr-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.map(c => (
              <TableRow key={c.id} className="hover:bg-black/5 transition-colors border-b last:border-0 h-12">
                <TableCell className="pl-8 py-0 w-24"><span className="font-black text-[10px] text-black/40">{c.id}</span></TableCell>
                <TableCell className="py-0"><span className="font-black text-[11px] text-black uppercase">{c.name}</span></TableCell>
                <TableCell className="text-right pr-8 py-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-2xl border-black/10 p-2">
                      <DropdownMenuItem className="text-[9px] font-black uppercase gap-2 p-3 rounded-xl"><Edit2 className="w-3.5 h-3.5" style={{ color: brandColor }} /> Editar</DropdownMenuItem>
                      <DropdownMenuItem className="text-[9px] font-black uppercase gap-2 p-3 rounded-xl text-destructive" onClick={() => deleteDoc(doc(db, "customers", c.id))}><Trash2 className="w-3.5 h-3.5" /> Eliminar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
