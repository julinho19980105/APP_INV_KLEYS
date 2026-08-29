
"use client"

import * as React from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { 
  Plus, 
  Search, 
  Lock, 
  Unlock, 
  RotateCcw, 
  CreditCard,
  Loader2,
  Trash2,
  Filter,
  Edit2,
  X,
  Check,
  MoreVertical,
  Star,
  Eraser,
  User,
  ShieldCheck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { useFirestore, useDoc, useCollection } from "@/firebase"
import { 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  limit, 
  deleteDoc, 
  updateDoc,
  setDoc
} from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'

const STORAGE_KEY = "stilo_payment_draft"

export default function PaymentsView() {
  const db = useFirestore()
  const { toast } = useToast()
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: config } = useDoc(configDocRef)
  const banks = React.useMemo(() => config?.banks || [], [config])

  const [saving, setSaving] = React.useState(false)
  const [date, setDate] = React.useState<Date>(new Date())
  const [amount, setAmount] = React.useState("")
  const [selectedBank, setSelectedBank] = React.useState<any>(null)
  const [selectedCustomer, setSelectedCustomer] = React.useState<any>(null)
  const [customerSearch, setCustomerSearch] = React.useState("")
  const [listFilter, setListFilter] = React.useState("")
  const [isBankGrouped, setIsBankGrouped] = React.useState(true)
  
  const [editingPayment, setEditingPayment] = React.useState<any>(null)
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null)

  const dateKey = format(date, "yyyy-MM-dd")
  const dayLockRef = React.useMemo(() => db ? doc(db, "dayLocks", dateKey) : null, [db, dateKey])
  const { data: dayLock } = useDoc(dayLockRef)
  const isDayClosed = !!dayLock?.isLocked

  React.useEffect(() => {
    const hasUnsavedChanges = amount !== "" || selectedCustomer !== null;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && !saving) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [amount, selectedCustomer, saving]);

  const customersRef = React.useMemo(() => db ? query(collection(db, "customers"), orderBy("name")) : null, [db])
  const { data: dbCustomers = [] } = useCollection(customersRef)

  const dayLocksRef = React.useMemo(() => db ? collection(db, "dayLocks") : null, [db])
  const { data: allDayLocks = [] } = useCollection(dayLocksRef)

  const paymentsQuery = React.useMemo(() => {
    if (!db) return null
    return query(collection(db, "payments"), orderBy("date", "desc"), limit(200))
  }, [db])
  const { data: payments = [], loading } = useCollection(paymentsQuery)

  React.useEffect(() => {
    if (!editingPayment) {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.date) setDate(new Date(parsed.date))
          if (parsed.amount) setAmount(parsed.amount)
        } catch (e) {}
      }
    }
  }, [editingPayment])

  React.useEffect(() => {
    if (!editingPayment) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        date: date.toISOString(),
        amount
      }))
    }
  }, [date, amount, editingPayment])

  React.useEffect(() => {
    if (banks.length > 0 && !selectedBank) {
      const dbDefault = banks.find((b: any) => b.isDefault);
      setSelectedBank(dbDefault || banks[0])
    }
  }, [banks, selectedBank])

  const handleReset = () => {
    if (amount !== "" || selectedCustomer !== null) {
      if (!confirm("¿DESCARTAR DATOS DEL PAGO ACTUAL?")) return;
    }
    setEditingPayment(null)
    setDate(new Date())
    setAmount("")
    setSelectedCustomer(null)
    setCustomerSearch("")
    localStorage.removeItem(STORAGE_KEY)
    const dbDefault = banks.find((b: any) => b.isDefault);
    setSelectedBank(dbDefault || (banks.length > 0 ? banks[0] : null))
  }

  const handleSavePayment = () => {
    if (!db || !selectedCustomer || !amount || !selectedBank) {
      toast({ variant: "destructive", title: "DATOS INCOMPLETOS" })
      return
    }

    if (isDayClosed && !editingPayment) {
      toast({ variant: "destructive", title: "FECHA BLOQUEADA" })
      return
    }

    setSaving(true)
    
    const paymentData = {
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      amount: Number(amount),
      bankId: selectedBank.id,
      bankName: selectedBank.name,
      date: format(date, "yyyy-MM-dd"),
      isLocked: editingPayment ? editingPayment.isLocked : false,
      updatedAt: serverTimestamp(),
      ...(editingPayment ? {} : { createdAt: serverTimestamp() })
    }

    const docRef = editingPayment 
      ? doc(db, "payments", editingPayment.id)
      : collection(db, "payments")

    const action = editingPayment 
      ? updateDoc(docRef as any, paymentData)
      : addDoc(docRef as any, paymentData)

    action.then(() => {
        setEditingPayment(null)
        setDate(new Date())
        setAmount("")
        setSelectedCustomer(null)
        setCustomerSearch("")
        localStorage.removeItem(STORAGE_KEY)
        setSaving(false)
        toast({ title: editingPayment ? "PAGO ACTUALIZADO" : "PAGO REGISTRADO" })
      })
      .catch(async (err) => {
        setSaving(false)
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: editingPayment ? `payments/${editingPayment.id}` : 'payments',
          operation: editingPayment ? 'update' : 'create',
          requestResourceData: paymentData
        }));
      });
  }

  const togglePaymentLock = (payment: any) => {
    if (!db) return
    const pRef = doc(db, "payments", payment.id)
    updateDoc(pRef, { isLocked: !payment.isLocked, updatedAt: serverTimestamp() }).catch(() => {})
  }

  const toggleDayLock = (currentDateKey: string, allPaymentsInDay: any[], isCurrentLocked: boolean) => {
    if (!db) return
    
    if (!isCurrentLocked) {
      const allLocked = allPaymentsInDay.length > 0 && allPaymentsInDay.every(p => p.isLocked)
      if (!allLocked) {
        toast({ variant: "destructive", title: "BLOQUEADO", description: "Cierre los candados individuales primero." })
        return
      }
    }

    const lockRef = doc(db, "dayLocks", currentDateKey)
    setDoc(lockRef, {
      date: currentDateKey,
      isLocked: !isCurrentLocked,
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(() => {})
    
    toast({ title: isCurrentLocked ? "DÍA ABIERTO" : "DÍA CERRADO" })
  }

  const startEditing = (p: any) => {
    if (p.isLocked) return
    setEditingPayment(p)
    setDate(new Date(p.date + "T12:00:00"))
    setAmount(p.amount.toString())
    setSelectedCustomer({ id: p.customerId, name: p.customerName })
    setSelectedBank(banks.find((b: any) => b.id === p.bankId) || { id: p.bankId, name: p.bankName })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = (pId: string) => {
    if (!db) return
    const pRef = doc(db, "payments", pId)
    deleteDoc(pRef).catch(async () => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: pRef.path, operation: 'delete' }));
    })
    setDeleteConfirmId(null)
    toast({ title: "Pago eliminado" })
  }

  const filteredCustomers = React.useMemo(() => {
    if (customerSearch.length < 1) return []
    const q = customerSearch.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return dbCustomers.filter(c => c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) || c.id.toLowerCase().includes(q))
  }, [customerSearch, dbCustomers])

  const filteredPayments = React.useMemo(() => {
    const q = listFilter.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return payments.filter(p => 
      p.customerName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q) || 
      p.customerId.toLowerCase().includes(q)
    )
  }, [payments, listFilter])

  const groupedPayments = React.useMemo(() => {
    const groups: Record<string, { label: string, dateKey: string, total: number, isDayLocked: boolean, payments: any[], bankGroups: any[] }> = {}
    
    filteredPayments.forEach(p => {
      const label = format(new Date(p.date + "T12:00:00"), "EEEE d MMMM", { locale: es }).toUpperCase()
      const isLocked = allDayLocks.find(l => l.date === p.date)?.isLocked || false
      
      if (!groups[p.date]) groups[p.date] = { label, dateKey: p.date, total: 0, isDayLocked: isLocked, payments: [], bankGroups: [] }
      groups[p.date].payments.push(p)
      groups[p.date].total += p.amount
    })

    const finalGroups = Object.values(groups).sort((a, b) => b.dateKey.localeCompare(a.dateKey))

    if (isBankGrouped) {
      finalGroups.forEach(g => {
        const bankMap: Record<string, { bankName: string, total: number, count: number, records: any[] }> = {}
        g.payments.forEach(p => {
          if (!bankMap[p.bankName]) bankMap[p.bankName] = { bankName: p.bankName, total: 0, count: 0, records: [] }
          bankMap[p.bankName].total += p.amount
          bankMap[p.bankName].count += 1
          bankMap[p.bankName].records.push(p)
        })
        g.bankGroups = Object.values(bankMap).sort((a, b) => b.total - a.total)
      })
    }

    return finalGroups
  }, [filteredPayments, isBankGrouped, allDayLocks])

  return (
    <div className="space-y-1.5 px-1 md:px-0 pb-24 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Registro de Pago ERP */}
      <Card className={cn(
        "rounded-2xl border border-slate-300 bg-white shadow-lg relative transition-all overflow-visible",
        isDayClosed && !editingPayment && "opacity-90"
      )}>
        <div className={cn(
          "py-2 px-6 flex justify-between items-center rounded-t-2xl transition-colors",
          isDayClosed && !editingPayment ? "bg-red-600" : "bg-[#1e293b]"
        )}>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
               <CreditCard className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-[9px] font-bold uppercase text-slate-100 tracking-[0.2em]">
              {editingPayment ? "EDITAR ABONO" : isDayClosed ? "FECHA CERRADA" : "REGISTRAR ABONO"}
            </span>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 mr-2">
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">AGRUPAR</span>
                <Switch checked={isBankGrouped} onCheckedChange={setIsBankGrouped} className="h-4 w-8 data-[state=checked]:bg-primary" />
             </div>
             <Button variant="ghost" size="icon" className="h-6 w-6 text-white/20 hover:text-white transition-colors" onClick={handleReset}>
                <Eraser className="w-3 h-3" />
             </Button>
          </div>
        </div>
        <CardContent className="p-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[9px] font-bold text-slate-400 uppercase ml-2 tracking-widest">FECHA PAGO</Label>
              <input 
                type="date"
                value={format(date, "yyyy-MM-dd")}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) setDate(new Date(val + "T12:00:00"));
                }}
                className="w-full h-11 px-4 rounded-xl border border-slate-300 font-medium text-[11px] uppercase bg-slate-50 text-slate-800 shadow-inner focus:outline-none focus:ring-1 focus:ring-primary/10"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] font-bold text-slate-400 uppercase ml-2 tracking-widest">MONTO SOLES</Label>
              <Input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                className="h-11 text-center text-base font-black text-slate-900 bg-slate-50 border-slate-300 rounded-xl shadow-inner font-headline"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[9px] font-bold text-slate-400 uppercase ml-2 tracking-widest">BANCO / DESTINO</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {banks.map((bank: any) => (
                <Button
                  key={bank.id}
                  variant="outline"
                  className={cn(
                    "h-11 rounded-xl font-medium text-[10px] uppercase border-slate-300 transition-all",
                    selectedBank?.id === bank.id ? "bg-[#10b981] text-white border-[#10b981] shadow-md" : "bg-white text-slate-600 hover:bg-slate-50"
                  )}
                  onClick={() => setSelectedBank(bank)}
                >
                  {bank.name} {selectedBank?.id === bank.id && <Star className="w-2.5 h-2.5 ml-1.5 fill-current" />}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1 relative z-[90]">
            <Label className="text-[9px] font-bold text-slate-400 uppercase ml-2 tracking-widest">CLIENTE</Label>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                <Input 
                  placeholder="SELECCIONAR CLIENTE..." 
                  className={cn("h-12 pl-12 pr-4 bg-slate-50 border-slate-300 rounded-xl font-medium text-[11px] uppercase shadow-inner text-slate-800", editingPayment && "bg-slate-100 opacity-60")}
                  value={selectedCustomer ? `${selectedCustomer.name} [${selectedCustomer.id}]` : customerSearch}
                  onChange={e => { if (!editingPayment) { if (selectedCustomer) setSelectedCustomer(null); setCustomerSearch(e.target.value); } }}
                  readOnly={!!editingPayment}
                />
                {customerSearch.length > 0 && !editingPayment && (
                  <div className="absolute z-[100] w-full mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                    {filteredCustomers.map(c => (
                      <button key={c.id} className="w-full text-left px-6 py-3.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 font-medium text-[10px] uppercase transition-colors text-slate-700" onClick={() => { setSelectedCustomer(c); setCustomerSearch(""); }}>
                        {c.name} <span className="text-slate-400 ml-2 font-normal">[{c.id}]</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button 
                className={cn("h-12 w-12 rounded-xl text-white shadow-lg shrink-0 active:scale-95 transition-all", editingPayment ? "bg-orange-500" : isDayClosed ? "bg-red-500" : "bg-[#0296FF]")}
                onClick={handleSavePayment}
                disabled={saving || !amount || !selectedCustomer || !selectedBank || (isDayClosed && !editingPayment)}
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : editingPayment ? <Check className="w-6 h-6" /> : isDayClosed ? <Lock className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listado y Filtros */}
      <div className="space-y-2 pt-1">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-primary/10 p-1.5 rounded-lg">
             <Filter className="w-3.5 h-3.5 text-primary" />
          </div>
          <Input 
            placeholder="FILTRAR POR CLIENTE..." 
            className="h-11 pl-12 bg-white border-slate-300 rounded-xl font-medium text-[10px] uppercase text-slate-700 shadow-sm" 
            value={listFilter} 
            onChange={e => setListFilter(e.target.value)} 
          />
        </div>

        {loading && (
          <div className="py-20 text-center opacity-30"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>
        )}

        {groupedPayments.map(group => (
          <div key={group.dateKey} className="space-y-1">
            {/* Cabecera de Fecha Dinámica (Navy o Roja si está cerrada) */}
            <div className={cn(
              "px-5 py-2.5 rounded-[2rem] flex justify-between items-center shadow-lg border border-slate-700/20 transition-colors",
              group.isDayLocked ? "bg-red-600" : "bg-[#1e293b]"
            )}>
              <span className="text-[10px] font-bold uppercase text-white tracking-widest">{group.label}</span>
              <div className="flex items-center gap-3">
                <span className="font-headline font-black text-[13px] text-[#10b981]">S/{group.total.toFixed(1)}</span>
                <button 
                  onClick={() => toggleDayLock(group.dateKey, group.payments, group.isDayLocked)}
                  className={cn(
                    "transition-all p-1.5 rounded-full shadow-inner",
                    group.isDayLocked ? "bg-white/20 text-white" : "bg-white/10 text-white/40"
                  )}
                >
                  {group.isDayLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1 px-1">
              {isBankGrouped ? group.bankGroups.map((bg, idx) => (
                <div key={idx} className="space-y-1">
                  {/* Cabecera de Banco Estilo Referencia (NARANJA) */}
                  <div className="flex items-center justify-between px-6 py-1.5 bg-[#f97316] rounded-[2rem] border border-orange-600/20 shadow-md">
                    <span className="text-[9px] font-bold text-white uppercase tracking-widest">{bg.bankName}</span>
                    <span className="text-[11px] font-black text-white/90">S/ {bg.total.toFixed(1)}</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {bg.records.map(p => <PaymentRecord key={p.id} p={p} onEdit={startEditing} onDelete={handleDelete} onLock={togglePaymentLock} deleteConfirmId={deleteConfirmId} setDeleteConfirmId={setDeleteConfirmId} />)}
                  </div>
                </div>
              )) : group.payments.map(p => <PaymentRecord key={p.id} p={p} onEdit={startEditing} onDelete={handleDelete} onLock={togglePaymentLock} deleteConfirmId={deleteConfirmId} setDeleteConfirmId={setDeleteConfirmId} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PaymentRecord({ p, onEdit, onDelete, onLock, deleteConfirmId, setDeleteConfirmId }: any) {
  return (
    <Card className={cn(
      "rounded-[2rem] border border-[#3b82f6]/30 bg-white shadow-sm transition-all active:scale-[0.98] relative overflow-hidden",
      p.isLocked && "bg-slate-50/30"
    )}>
      {/* Barra de acento lateral azul */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#3b82f6]/40" />
      
      <CardContent className="p-3 pl-6 flex items-center justify-between">
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[13px] text-slate-800 uppercase truncate leading-tight">{p.customerName}</span>
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500/60" />
          </div>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-[8px] font-bold text-blue-400/80 uppercase tracking-widest">{p.bankName}</span>
             <Badge className="bg-blue-50 text-blue-500 text-[7px] font-bold h-3.5 px-1.5 border border-blue-100 uppercase">PROCESADO</Badge>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="font-headline font-black text-[15px] text-blue-600 leading-none mr-1">S/{Number(p.amount).toFixed(1)}</div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onLock(p)}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-md", 
                p.isLocked ? "bg-blue-500 text-white shadow-blue-200" : "bg-slate-100 text-slate-300"
              )}
            >
              {p.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>

            <Badge variant="outline" className="bg-blue-50/50 text-blue-400 border-blue-100 text-[7px] font-bold h-5 px-2 uppercase tracking-widest">
              VERIFICADO
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button disabled={p.isLocked} className="p-1.5 text-slate-300 hover:text-primary transition-colors disabled:opacity-0">
                  <MoreVertical className="w-4.5 h-4.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl p-2 w-44 shadow-2xl border-slate-300">
                <DropdownMenuItem className="text-[10px] font-bold uppercase gap-3 p-3 rounded-xl" onClick={() => onEdit(p)}>
                  <Edit2 className="w-3.5 h-3.5 text-primary" /> Editar Registro
                </DropdownMenuItem>
                
                <Popover open={deleteConfirmId === p.id} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                  <PopoverTrigger asChild>
                    <button className="w-full text-left flex items-center gap-3 px-3 py-3 text-[10px] font-bold uppercase text-red-500 hover:bg-red-50 rounded-xl transition-colors" onClick={() => setDeleteConfirmId(p.id)}>
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar Pago
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4 rounded-2xl border-none shadow-2xl bg-[#1e293b] text-white" side="top">
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">¿ELIMINAR ESTE PAGO?</span>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-8 px-4 text-[9px] font-black bg-red-500 text-white hover:bg-red-600 rounded-lg" onClick={() => onDelete(p.id)}>SÍ, BORRAR</Button>
                        <Button size="sm" variant="ghost" className="h-8 px-4 text-[9px] font-black text-slate-300 hover:bg-white/10 rounded-lg" onClick={() => setDeleteConfirmId(null)}>CANCELAR</Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
