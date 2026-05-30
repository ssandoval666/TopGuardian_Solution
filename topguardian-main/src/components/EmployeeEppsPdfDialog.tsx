import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { apiCall } from "@/services/api";
import { Document, Page, Text, View, StyleSheet, PDFViewer, Image, PDFDownloadLink } from "@react-pdf/renderer";
import shieldLogo from "@/assets/shield-logo.png";

interface AssignedEpp {
  id: number;
  employee_id: number;
  epp_id: number;
  epp_name: string;
  delivery_date: string;
  delivered_by_user_name: string | null;
  quantity: number;
  signature_data: any;
}

interface EmployeeEppsPdfDialogProps {
  employeeId: string | number | null;
  employeeName: string;
  employeeDocument: string;
  companyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const toBase64DataUri = (signatureData: any) => {
  const byteArray = signatureData?.data || signatureData;
  if (!byteArray || !Array.isArray(byteArray) || byteArray.length === 0) return null;
  
  let binary = '';
  for (let i = 0; i < byteArray.length; i++) {
    binary += String.fromCharCode(byteArray[i]);
  }
  return 'data:image/png;base64,' + window.btoa(binary);
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12 },
  headerSection: { marginBottom: 20 },
  topHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  logo: { width: 56, height: 56, marginRight: 15 },
  mainTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  infoLine: { fontSize: 12, color: '#111827', marginBottom: 5 },
  table: { display: "flex", width: "auto", borderStyle: "solid", borderWidth: 1, borderRightWidth: 0, borderBottomWidth: 0, marginTop: 10 },
  tableRow: { margin: "auto", flexDirection: "row" },
  
  tableColHeaderDate: { width: "18%", borderStyle: "solid", borderBottomWidth: 1, borderRightWidth: 1, backgroundColor: '#f3f4f6', padding: 6 },
  tableColHeaderEpp: { width: "27%", borderStyle: "solid", borderBottomWidth: 1, borderRightWidth: 1, backgroundColor: '#f3f4f6', padding: 6 },
  tableColHeaderQty: { width: "10%", borderStyle: "solid", borderBottomWidth: 1, borderRightWidth: 1, backgroundColor: '#f3f4f6', padding: 6 },
  tableColHeaderUser: { width: "20%", borderStyle: "solid", borderBottomWidth: 1, borderRightWidth: 1, backgroundColor: '#f3f4f6', padding: 6 },
  tableColHeaderSig: { width: "25%", borderStyle: "solid", borderBottomWidth: 1, borderRightWidth: 1, backgroundColor: '#f3f4f6', padding: 6 },

  tableColDate: { width: "18%", borderStyle: "solid", borderBottomWidth: 1, borderRightWidth: 1, padding: 6, justifyContent: 'center' },
  tableColEpp: { width: "27%", borderStyle: "solid", borderBottomWidth: 1, borderRightWidth: 1, padding: 6, justifyContent: 'center' },
  tableColQty: { width: "10%", borderStyle: "solid", borderBottomWidth: 1, borderRightWidth: 1, padding: 6, justifyContent: 'center' },
  tableColUser: { width: "20%", borderStyle: "solid", borderBottomWidth: 1, borderRightWidth: 1, padding: 6, justifyContent: 'center' },
  tableColSig: { width: "25%", borderStyle: "solid", borderBottomWidth: 1, borderRightWidth: 1, padding: 2, justifyContent: 'center', alignItems: 'center' },

  tableCellHeader: { fontSize: 10, fontWeight: 'bold' },
  tableCell: { fontSize: 10 }
});

const EppPdfDocument = ({ employeeName, employeeDocument, companyName, data }: { employeeName: string, employeeDocument: string, companyName: string, data: AssignedEpp[] }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.headerSection}>
        <View style={styles.topHeader}>
          <Image src={shieldLogo} style={styles.logo} />
          <Text style={styles.mainTitle}>Seguimiento de Entrega de EPPs</Text>
        </View>
        <Text style={styles.infoLine}>Empresa: {companyName}</Text>
        <Text style={styles.infoLine}>Empleado: {employeeName}</Text>
        <Text style={styles.infoLine}>Documento: {employeeDocument}</Text>
      </View>
      <View style={styles.table}>
        <View style={styles.tableRow}>
          <View style={styles.tableColHeaderDate}><Text style={styles.tableCellHeader}>Fecha</Text></View>
          <View style={styles.tableColHeaderEpp}><Text style={styles.tableCellHeader}>Elemento (EPP)</Text></View>
          <View style={styles.tableColHeaderQty}><Text style={styles.tableCellHeader}>Cant.</Text></View>
          <View style={styles.tableColHeaderUser}><Text style={styles.tableCellHeader}>Entregado por</Text></View>
          <View style={styles.tableColHeaderSig}><Text style={styles.tableCellHeader}>Firma Empleado</Text></View>
        </View>
        {data.map((row, i) => {
          const sigUri = toBase64DataUri(row.signature_data);
          return (
            <View key={i} style={styles.tableRow}>
              <View style={styles.tableColDate}><Text style={styles.tableCell}>{row.delivery_date}</Text></View>
              <View style={styles.tableColEpp}><Text style={styles.tableCell}>{row.epp_name}</Text></View>
              <View style={styles.tableColQty}><Text style={styles.tableCell}>{row.quantity || 1}</Text></View>
              <View style={styles.tableColUser}><Text style={styles.tableCell}>{row.delivered_by_user_name || 'Sistema'}</Text></View>
              <View style={styles.tableColSig}>
                {sigUri ? (
                  <Image src={sigUri} style={{ height: 20, width: "auto", objectFit: 'contain' }} />
                ) : (
                  <Text style={styles.tableCell}>-</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </Page>
  </Document>
);

export default function EmployeeEppsPdfDialog({ employeeId, employeeName, employeeDocument, companyName, open, onOpenChange }: EmployeeEppsPdfDialogProps) {
  const [data, setData] = useState<AssignedEpp[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && employeeId) {
      const loadData = async () => {
        setLoading(true);
        try {
          const res = await apiCall(`/employee-epps/employee/${employeeId}`);
          setData(res);
        } catch (error: any) {
          toast.error("Error al cargar historial de EPPs");
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }
  }, [open, employeeId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Reporte de EPPs
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 bg-muted/30 rounded-md overflow-hidden border mt-2">
            {data.length > 0 ? (
              <PDFViewer width="100%" height="100%" className="border-0" showToolbar={false}>
                <EppPdfDocument employeeName={employeeName} employeeDocument={employeeDocument} companyName={companyName} data={data} />
              </PDFViewer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground flex-col gap-2">
                <FileText className="h-12 w-12 opacity-20" />
                <p>No hay EPPs registrados para este empleado.</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          {data.length > 0 && (
            <PDFDownloadLink
              document={<EppPdfDocument employeeName={employeeName} employeeDocument={employeeDocument} companyName={companyName} data={data} />}
              fileName={`Seguimiento_EPPs_${employeeName.replace(/\s+/g, "_")}.pdf`}
              className="flex"
            >
              {({ loading }) => (
                <Button disabled={loading} className="w-full sm:w-auto">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Descargar PDF
                </Button>
              )}
            </PDFDownloadLink>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}