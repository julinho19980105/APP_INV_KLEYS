
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  Search, 
  Ban, 
  Printer, 
  MoreVertical,
  Check,
  X,
  Edit2,
  Image as ImageIcon,
  Bluetooth,
  FileText
} from "lucide-react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { useCollection, useFirestore, useDoc } from "@/firebase"
import { collection, query, orderBy, doc, updateDoc, increment, addDoc, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { toJpeg } from 'html-to-image'

export default function SalesPage() {
  const router = useRouter()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("active")
  const [confirmAnnulId, setConfirmAnnulId] = React.useState<string | null>(null)
  const [bleDevice, setBleDevice] = React.useState<BluetoothDevice | null>(null)
  const [bleCharacteristic, setBleCharacteristic] = React.useState<BluetoothRemoteGATTCharacteristic | null>(null)
  const receiptRef = React.useRef<HTMLDivElement>(null)
  const [activeReceipt, setActiveReceipt] = React.useState<any>(null)
  
  const configDocRef = React.useMemo(() => db ? doc(db, "config", "global") : null, [db])
  const { data: companySettings } = useDoc(configDocRef)

  const quotesRef = React.useMemo(() => db ? query(collection(db, "quotes"), orderBy("createdAt", "desc")) : null, [db])
  const { data: quotes = [] } = useCollection(quotesRef)

  const currentMonthTotal = React.useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    
    return quotes
      .filter(q => {
        const date = q.createdAt?.toDate ? q.createdAt.toDate() : new Date()
        const isThisMonth = date.getMonth() === currentMonth && date.getFullYear() === currentYear
        const isValidStatus = q.status === 'active' || q.status === 'shipped'
        return isThisMonth && isValidStatus
      })
      .reduce((acc, q) => acc + (q.total || 0), 0)
  }, [quotes])

  const filteredQuotes = React.useMemo(() => {
    const q = searchQuery.toLowerCase()
    return quotes.filter(s => {
      const matchesSearch = s.id.toLowerCase().includes(q) || s.customerName?.toLowerCase().includes(q)
      const matchesStatus = statusFilter === "all" || s.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [quotes, searchQuery, statusFilter])

  const groupedSales = React.useMemo(() => {
    const groups: Record<string, { dateLabel: string, sales: any[], dayTotal: number }> = {}
    filteredQuotes.forEach(sale => {
      const date = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date()
      const dayLabel = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()
      if (!groups[dayLabel]) groups[dayLabel] = { dateLabel: dayLabel, sales: [], dayTotal: 0 }
      groups[dayLabel].sales.push(sale)
      if (sale.status !== 'annulled') groups[dayLabel].dayTotal += (sale.total || 0)
    })
    return Object.values(groups)
  }, [filteredQuotes])

  const annulQuote = async (quote: any) => {
    if (!db) return
    try {
      await updateDoc(doc(db, "quotes", quote.id), { status: 'annulled' })
      for (const item of quote.items) {
        if (item.isRegistered && item.productId !== "MANUAL") {
          await updateDoc(doc(db, "products", item.productId), { stock: increment(item.quantity) })
          await addDoc(collection(db, "movements"), {
            productCode: item.productId,
            type: "return",
            quantity: item.quantity,
            reason: `ANULACIÓN BOLETA ${quote.id}`,
            timestamp: serverTimestamp()
          })
        }
      }
      toast({ title: "BOLETA ANULADA" })
      setConfirmAnnulId(null)
    } catch (e) {
      toast({ variant: "destructive", title: "ERROR" })
    }
  }

  const sanitize = (text: string) => {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ñ/g, "n")
      .replace(/Ñ/g, "N")
  }

  const padLine = (left: string, right: string, width: number) => {
    const spaces = width - (left.length + right.length);
    return left + " ".repeat(Math.max(1, spaces)) + right;
  }

  const handlePrintBLE = async (sale: any) => {
    if (!bleDevice || !bleCharacteristic) {
      try {
        toast({ title: "BUSCANDO IMPRESORA..." })
        const device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb']
        })
        
        const server = await device.gatt.connect()
        const services = await server.getPrimaryServices()
        let char = null
        for (const service of services) {
          const characteristics = await service.getCharacteristics()
          char = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse)
          if (char) break
        }

        if (char) {
          setBleDevice(device)
          setBleCharacteristic(char)
          toast({ title: "IMPRESORA CONECTADA", description: "PULSE IMPRIMIR OTRA VEZ." })
        } else {
          toast({ variant: "destructive", title: "IMPRESORA NO COMPATIBLE" })
        }
      } catch (e) {
        toast({ variant: "destructive", title: "ERROR DE CONEXIÓN" })
      }
      return
    }

    try {
      toast({ title: "GENERANDO TICKET..." })
      const companyName = companySettings?.companyName || "DIVA INDUSTRIAL";
      const printerWidth = parseInt(companySettings?.printerWidth || "80");
      const charLimit = printerWidth === 80 ? 48 : 32;
      
      let t = `\x1B\x40` // Reset
      t += `\x1B\x61\x01` // Center
      t += `\x1B\x21\x30${sanitize(companyName).toUpperCase()}\n`
      t += `\x1B\x21\x08BOLETA INTERNA: ${sale.id}\n\n`
      
      t += `\x1B\x61\x00` // Left
      t += padLine("CLIENTE:", "FECHA:", charLimit) + "\n"
      const dateStr = sale.createdAt?.toDate ? sale.createdAt.toDate().toLocaleDateString() : "";
      t += padLine(sanitize(sale.customerName).substring(0, charLimit/2), dateStr, charLimit) + "\n"
      t += "-".repeat(charLimit) + "\n"
      
      sale.items.forEach((i: any, idx: number) => {
        const subtotal = `S/ ${(Number(i.quantity) * Number(i.price) - Number(i.discount)).toFixed(2)}`;
        t += padLine(`${idx + 1}- ${sanitize(i.name)}`, subtotal, charLimit) + "\n"
        t += `   ${i.quantity} x S/ ${Number(i.price).toFixed(2)}${Number(i.discount) > 0 ? ` (-S/ ${Number(i.discount).toFixed(2)})` : ''}\n`
        if (i.description) {
          t += `   ${sanitize(i.description).substring(0, charLimit - 3)}\n`
        }
      })
      
      t += "-".repeat(charLimit) + "\n"
      
      const totalQty = sale.items.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0);
      t += padLine(`CANT. TOTAL: ${totalQty}`, `TOTAL: S/ ${Number(sale.total).toFixed(2)}`, charLimit) + "\n"
      
      t += "\n\x1B\x61\x01" // Center
      t += "Gracias por su Compra\n"
      t += "\n\n\n\n\x1D\x56\x42\x00" // Cut

      const encoder = new TextEncoder()
      const data = encoder.encode(t)
      const chunkSize = 20
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize)
        await bleCharacteristic.writeValue(chunk)
      }
      
      toast({ title: "TICKET ENVIADO" })
    } catch (err) {
      toast({ variant: "destructive", title: "ERROR DE HARDWARE" })
      setBleDevice(null)
      setBleCharacteristic(null)
    }
  }

  const handleSendImage = async (sale: any) => {
    setActiveReceipt(sale)
    setTimeout(async () => {
      if (receiptRef.current) {
        try {
          const dataUrl = await toJpeg(receiptRef.current, { quality: 0.95, backgroundColor: '#ffffff' })
          const blob = await (await fetch(dataUrl)).blob()
          const file = new File([blob], `Boleta_${sale.id}.jpg`, { type: 'image/jpeg' })
          if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            await navigator.share({ files: [file], title: `Boleta ${sale.id}` })
          } else {
            const link = document.createElement('a')
            link.download = `Boleta_${sale.id}.jpg`
            link.href = dataUrl
            link.click()
            toast({ title: "IMAGEN DESCARGADA", description: "LISTO PARA COMPARTIR." })
          }
        } catch (err) {
          toast({ variant: "destructive", title: "ERROR AL GENERAR IMAGEN" })
        }
      }
    }, 400)
  }

  const brandColor = companySettings?.brandColor || "#2563EB";
  const companyName = companySettings?.companyName || "MODA KEYTI KIDS";

  return (
    <div className="space-y-6 pt-2 pb-20 max-w-4xl mx-auto px-2 md:px-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-4 border-black pb-6">
        <div>
          <h1 className="text-sm font-black text-black uppercase tracking-[0.3em]">Total Ventas del Mes</h1>
          <div className="font-headline font-black text-5xl md:text-6xl text-black tracking-tighter mt-1">
            S/ {currentMonthTotal.toFixed(2)}
          </div>
        </div>
        <div className="flex w-full md:w-auto gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-black/40" />
            <Input 
              placeholder="BUSCAR..." 
              className="pl-10 h-11 rounded-xl border-black/10 font-black text-xs uppercase bg-white shadow-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-11 rounded-xl border-black/10 font-black text-[10px] uppercase bg-white">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="text-[10px] font-black uppercase">Todos</SelectItem>
              <SelectItem value="active" className="text-[10px] font-black uppercase">Activos</SelectItem>
              <SelectItem value="shipped" className="text-[10px] font-black uppercase">Enviados</SelectItem>
              <SelectItem value="annulled" className="text-[10px] font-black uppercase">Anulados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-8">
        {groupedSales.map(group => (
          <div key={group.dateLabel} className="space-y-4">
            <div className="flex justify-between items-center px-6 py-3 bg-black text-white rounded-2xl shadow-lg">
              <span className="text-[10px] font-black uppercase tracking-widest">{group.dateLabel}</span>
              <span className="font-headline font-black text-lg">S/ {group.dayTotal.toFixed(2)}</span>
            </div>
            
            <div className="space-y-3">
              {group.sales.map(s => (
                <Card key={s.id} className={cn(
                  "rounded-2xl border border-black/5 overflow-hidden transition-all",
                  s.status === 'annulled' ? "opacity-40 bg-black/[0.02]" : "bg-white shadow-sm"
                )}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-center pr-8 md:pr-16">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-base text-black">{s.id}</span>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[7px] font-black h-4 px-2 uppercase border-none", 
                              s.status === 'active' && "bg-green-100 text-green-700",
                              s.status === 'shipped' && "bg-blue-100 text-blue-700",
                              s.status === 'annulled' && "bg-red-100 text-red-700"
                            )}
                          >
                            {s.status === 'active' ? 'ACTIVO' : s.status === 'shipped' ? 'ENVIADO' : 'ANULADO'}
                          </Badge>
                        </div>
                        <span className="font-headline font-black text-xl text-black">S/ {Number(s.total).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pr-8 md:pr-16">
                        <span className="text-[10px] font-black text-black/60 uppercase truncate max-w-[150px] md:max-w-none">
                          {s.customerName}
                        </span>
                        <span className="text-[10px] font-black text-black/40 uppercase">
                          {s.items?.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0)} UNID
                        </span>
                      </div>
                    </div>

                    <div className="relative">
                      {confirmAnnulId === s.id ? (
                        <div className="flex gap-1">
                          <Button size="icon" className="h-10 w-10 bg-destructive text-white rounded-xl" onClick={() => annulQuote(s)}><Check className="w-5 h-5" /></Button>
                          <Button size="icon" className="h-10 w-10 bg-black/5 text-black rounded-xl" onClick={() => setConfirmAnnulId(null)}><X className="w-5 h-5" /></Button>
                        </div>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-12 w-10 rounded-xl hover:bg-black/5">
                              <MoreVertical className="w-6 h-6 text-black" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl border-black/10 shadow-2xl p-2 w-56">
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-4 rounded-xl cursor-pointer" onClick={() => router.push(`/quotes?edit=${s.id}`)}>
                              <Edit2 className="w-4 h-4" /> Editar Venta
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-4 rounded-xl cursor-pointer" onClick={() => handlePrintBLE(s)}>
                              {bleDevice ? <Printer className="w-4 h-4" /> : <Bluetooth className="w-4 h-4" />} {bleDevice ? 'Imprimir Ticket' : 'Conectar Impresora'}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-4 rounded-xl cursor-pointer" onClick={() => handleSendImage(s)}>
                              <ImageIcon className="w-4 h-4" /> Enviar Imagen
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-4 rounded-xl cursor-pointer" onClick={() => {
                              const summary = `Venta ${s.id}\nCliente: ${s.customerName}\nTotal: S/ ${Number(s.total).toFixed(2)}\n\nItems:\n${s.items.map((i: any) => `- ${i.name} (${i.quantity})`).join('\n')}`;
                              navigator.clipboard.writeText(summary);
                              toast({ title: "RESUMEN COPIADO", description: "Listo para enviar." });
                            }}>
                              <FileText className="w-4 h-4" /> Enviar Texto
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-[11px] font-black uppercase gap-3 p-4 rounded-xl text-destructive cursor-pointer" onClick={() => setConfirmAnnulId(s.id)}>
                              <Ban className="w-4 h-4" /> Anular Boleta
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Hidden Receipt for Image Generation - Estilo Keyti Kids Adaptado */}
      <div className="fixed -left-[4000px] top-0">
        {activeReceipt && (
          <div 
            ref={receiptRef} 
            className="boleta"
            style={{
              width: '560px',
              backgroundColor: '#F4F5F7',
              padding: '25px 12px',
              fontFamily: 'Arial, "Segoe UI", sans-serif',
              color: '#1F2937'
            }}
          >
            <style dangerouslySetInnerHTML={{ __html: `
              .boleta-inner {
                width: 100%;
                background: white;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 8px 28px rgba(0,0,0,.10);
              }
              .cabecera-img {
                background: ${brandColor};
                color: white;
                text-align: center;
                padding: 22px 20px;
              }
              .empresa-img { font-size: 24px; font-weight: 800; letter-spacing: .5px; }
              .num-boleta-img { margin-top: 6px; font-size: 12px; font-weight: 700; letter-spacing: 1px; }
              .datos-img { padding: 16px 19px; }
              .cliente-img { display: flex; align-items: center; gap: 7px; font-size: 14px; }
              .cliente-label-img { font-size: 11px; font-weight: 800; color: #6B7280; }
              .cliente-nombre-img { font-weight: 800; }
              .cliente-codigo-img { font-size: 12px; font-weight: 700; color: ${brandColor}; }
              .fecha-hora-img { display: flex; justify-content: space-between; margin-top: 10px; }
              .fecha-hora-img span { font-size: 11px; color: #6B7280; }
              .fecha-hora-img strong { margin-left: 4px; font-size: 12px; color: #1F2937; }
              .linea-img { height: 1px; background: #E5E7EB; }
              .linea-fuerte-img { height: 2px; background: #1F2937; }
              .productos-img { padding: 5px 0 0; }
              .prod-cabecera-img { display: flex; justify-content: space-between; padding: 7px 19px; font-size: 8px; font-weight: 800; color: #6B7280; text-transform: uppercase; letter-spacing: .8px; }
              .producto-img { padding: 9px 19px; border-top: 1px solid #E5E7EB; }
              .prod-principal-img { display: grid; grid-template-columns: 23px 1fr auto; gap: 8px; align-items: start; }
              .num-circulo-img { width: 23px; height: 23px; display: flex; justify-content: center; align-items: center; border-radius: 5px; background: ${brandColor}; color: white; font-size: 10px; font-weight: 800; }
              .nombre-img { padding-top: 2px; font-size: 13px; font-weight: 800; line-height: 1.3; }
              .subtotal-img { text-align: right; white-space: nowrap; }
              .sub-label-img { display: block; font-size: 8px; color: #6B7280; text-transform: uppercase; }
              .sub-valor-img { display: block; margin-top: 1px; font-size: 15px; font-weight: 850; color: ${brandColor}; }
              .op-img { margin-left: 31px; margin-top: 3px; font-size: 11px; font-weight: 600; color: #1F2937; }
              .desc-img { margin-left: 5px; color: #DC2626; font-weight: 800; }
              .det-desc-img { margin-left: 31px; margin-top: 2px; font-size: 10px; color: #6B7280; }
              .totales-img { padding: 16px 19px 17px; }
              .totales-grid-img { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
              .box-img { min-height: 82px; padding: 13px; border: 1px solid #E5E7EB; border-radius: 8px; background: white; }
              .box-cant-img { border-top: 3px solid #1F2937; }
              .box-money-img { border-top: 3px solid ${brandColor}; text-align: right; }
              .box-label-img { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #6B7280; }
              .box-valor-img { margin-top: 6px; font-size: 24px; font-weight: 850; color: #1F2937; }
              .box-money-img .box-valor-img { color: ${brandColor}; }
              .agradecimiento-img { text-align: center; padding: 0 18px 22px; font-size: 11px; color: #6B7280; line-height: 1.5; }
              .agradecimiento-img strong { color: #1F2937; }
            ` }} />
            
            <div className="boleta-inner">
              <div className="cabecera-img">
                <div className="empresa-img">{companyName}</div>
                <div className="num-boleta-img">BOLETA INTERNA · {activeReceipt.id}</div>
              </div>

              <div className="datos-img">
                <div className="cliente-img">
                  <span className="cliente-label-img">CLIENTE:</span>
                  <span className="cliente-nombre-img">{activeReceipt.customerName.split(' [')[0]}</span>
                  <span className="cliente-codigo-img">· {activeReceipt.customerId}</span>
                </div>
                <div className="fecha-hora-img">
                  <span>FECHA: <strong>{activeReceipt.createdAt?.toDate ? activeReceipt.createdAt.toDate().toLocaleDateString('es-ES') : ""}</strong></span>
                  <span>HORA: <strong>{activeReceipt.createdAt?.toDate ? activeReceipt.createdAt.toDate().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ""}</strong></span>
                </div>
              </div>

              <div className="linea-fuerte-img"></div>

              <div className="productos-img">
                <div className="prod-cabecera-img">
                  <span>DETALLE</span>
                  <span>SUBTOTAL</span>
                </div>

                {activeReceipt.items.map((item: any, idx: number) => (
                  <div key={idx} className="producto-img">
                    <div className="prod-principal-img">
                      <div className="num-circulo-img">{idx + 1}</div>
                      <div className="nombre-img">{item.name}</div>
                      <div className="subtotal-img">
                        <span className="sub-label-img">Subtotal</span>
                        <span className="sub-valor-img">S/ {(Number(item.quantity) * Number(item.price) - Number(item.discount)).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="op-img">
                      {item.quantity} UND. × S/ {Number(item.price).toFixed(2)}
                      {Number(item.discount) > 0 && (
                        <span className="desc-img"> − DESC. S/ {Number(item.discount).toFixed(2)}</span>
                      )}
                    </div>
                    {item.description && <div className="det-desc-img">{item.description}</div>}
                  </div>
                ))}
              </div>

              <div className="linea-fuerte-img"></div>

              <div className="totales-img">
                <div className="totales-grid-img">
                  <div className="box-img box-cant-img">
                    <div className="box-label-img">Cantidad</div>
                    <div className="box-valor-img">
                      {activeReceipt.items.reduce((acc: number, i: any) => acc + Number(i.quantity), 0)} UND.
                    </div>
                  </div>
                  <div className="box-img box-money-img">
                    <div className="box-label-img">Total</div>
                    <div className="box-valor-img">S/ {Number(activeReceipt.total).toFixed(2)}</div>
                  </div>
                </div>
              </div>

              <div className="agradecimiento-img">
                <strong>¡Gracias por su compra!</strong><br />
                Agradecemos su preferencia y confianza.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
