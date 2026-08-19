
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
import { Search, UserPlus, Phone, MapPin, MoreVertical, Edit2, Trash2, Loader2 } from "lucide-react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { useCollection, useFirestore } from "@/firebase"
import { collection, query, orderBy, addDoc, serverTimestamp, setDoc, doc, limit, getDocs } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function CustomersPage() {
  const db = useFirestore()
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  const [newCustomer, setNewCustomer] = React.useState({
    name: "",
    phone: "",
    location: ""
  })

  const customersRef = React.useMemo(() => 
    db ? query(collection(db, "customers"), orderBy("id", "asc")) : null
  , [db])
  
  const { data: customers = [], loading } = useCollection(customersRef)

  const filteredCustomers = React.useMemo(() => {
    const q = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return customers.filter(c => 
      c.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) || 
      c.id?.toLowerCase().includes(q)
    )
  }, [customers, searchQuery])

  const handleRegister = async () => {
    if (!db || !newCustomer.name.trim()) return
    setSaving(true)
    try {
      const q = query(collection(db, "customers"), orderBy("id", "desc"), limit(1))
      const snap = await getDocs(q)
      let nextId = "CL-001"
      if (!snap.empty) {
        const lastId = snap.docs[0].id
        const match = lastId.match(/\d+/)
        const lastNum = match ? parseInt(match[0]) : 0
        nextId = `CL-${(lastNum + 1).toString().padStart(3, '0')}`
      }

      await setDoc(doc(db, "customers", nextId), {
        id: nextId,
        name: newCustomer.name.toUpperCase().trim(),
        phone: newCustomer.phone.trim(),
        location: newCustomer.location.toUpperCase().trim(),
        createdAt: serverTimestamp()
      })

      toast({ title: "CLIENTE REGISTRADO", description: `${nextId} AÑADIDO A LA CARTERA.` })
      setNewCustomer({ name: "", phone: "", location: "" })
      setIsDialogOpen(false)
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR", description: "FALLA AL REGISTRAR CLIENTE." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 pt-2 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-headline font-black text-black uppercase tracking-tight">Cartera de Clientes</h1>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] ml-1 mt-1">Gestión Industrial de Cuentas Diva</p>
        </div>
        <div className="flex w-full md:w-auto gap-3">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-black/40" />
            <Input 
              placeholder="BUSCAR POR NOMBRE O ID..." 
              className="pl-10 h-11 rounded-2xl border-black/10 font-black text-xs uppercase"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 bg-primary text-white font-black rounded-2xl px-6 shadow-lg active:scale-95 transition-all">
                <UserPlus className="w-4 h-4 mr-2" /> NUEVO CLIENTE
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] border-none shadow-2xl max-w-md">
              <DialogHeader>
                <DialogTitle className="text-sm font-black text-black uppercase tracking-widest">Alta de Cliente Industrial</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-black ml-1">Nombre Completo *</Label>
                  <Input 
                    value={newCustomer.name}
                    onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                    className="h-10 text-xs font-black uppercase rounded-xl border-black/10"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-black ml-1">Teléfono / WhatsApp</Label>
                  <Input 
                    value={newCustomer.phone}
                    onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                    className="h-10 text-xs font-black rounded-xl border-black/10"
                    placeholder="+51..."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-black ml-1">Ubicación / Ciudad</Label>
                  <Input 
                    value={newCustomer.location}
                    onChange={e => setNewCustomer({...newCustomer, location: e.target.value})}
                    className="h-10 text-xs font-black uppercase rounded-xl border-black/10"
                  />
                </div>
                <Button 
                  className="w-full h-12 bg-black text-white font-black rounded-xl mt-2"
                  onClick={handleRegister}
                  disabled={saving || !newCustomer.name}
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "REGISTRAR EN CARTERA"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="rounded-[2.5rem] border shadow-sm overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-black/5 hover:bg-black/5 border-none">
              <TableHead className="font-black text-[9px] uppercase text-black pl-8 w-24">ID</TableHead>
              <TableHead className="font-black text-[9px] uppercase text-black">Nombre del Cliente</TableHead>
              <TableHead className="font-black text-[9px] uppercase text-black"><div className="flex items-center gap-2"><Phone className="w-3 h-3" /> Teléfono</div></TableHead>
              <TableHead className="font-black text-[9px] uppercase text-black"><div className="flex items-center gap-2"><MapPin className="w-3 h-3" /> Ubicación</div></TableHead>
              <TableHead className="font-black text-[9px] uppercase text-black">Fecha Reg.</TableHead>
              <TableHead className="text-right pr-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.map(c => (
              <TableRow key={c.id} className="hover:bg-black/5 transition-colors group border-b last:border-0">
                <TableCell className="pl-8">
                  <span className="font-black text-[10px] bg-black text-white px-2 py-0.5 rounded-lg">{c.id}</span>
                </TableCell>
                <TableCell className="font-black text-[11px] text-black uppercase">{c.name}</TableCell>
                <TableCell className="text-[10px] font-black text-black/60">{c.phone || "---"}</TableCell>
                <TableCell className="text-[10px] font-black text-black/60 uppercase">{c.location || "---"}</TableCell>
                <TableCell className="text-[9px] font-black text-black/40 uppercase">
                  {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString() : "---"}
                </TableCell>
                <TableCell className="text-right pr-8">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-black/10">
                        <MoreVertical className="w-4 h-4 text-black" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-2xl border-black/10 shadow-2xl p-2">
                      <DropdownMenuItem className="text-[10px] font-black uppercase gap-2 cursor-pointer p-3 rounded-xl">
                        <Edit2 className="w-3.5 h-3.5" /> Editar Cliente
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-[10px] font-black uppercase gap-2 cursor-pointer p-3 rounded-xl text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {!loading && filteredCustomers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-24">
                  <div className="flex flex-col items-center gap-3 opacity-20">
                    <UserPlus className="w-12 h-12" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Sin clientes en la base de datos</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
