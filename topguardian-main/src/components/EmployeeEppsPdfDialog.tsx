import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { apiCall } from "@/services/api";
import { Document, Page, Text, View, StyleSheet, PDFViewer, Image } from "@react-pdf/renderer";
import shieldLogo from "@/assets/shield-logo.png";

interface AssignedEpp {
  id: number;
  employee_id: number;
  epp_id: number;
  epp_name: string;
  delivery_date: string;
  delivered_by_user_name: string | null;
}

interface EmployeeEppsPdfDialogProps {
  employeeId: string | number | null;
  employeeName: string;
  employeeDocument: string;
  companyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12 },
  headerSection: { marginBottom: 20 },
  topHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  logo: { width: 56, height: 56, marginRight: 15 },
  mainTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  infoLine: { fontSize: 12, color: '#111827', marginBottom: 5 },
  table: { display: "flex", width: "auto", borderStyle: "solid", borderWidth: 1, borderRightWidth: 0, borderBottomWidth: 0, marginTop: 10 },
  tableRow: { margin: "auto", flexDirection: "row" },
  tableColHeader: { width: "33.33%", borderStyle: "solid", borderBottomWidth: 1, borderRightWidth: 1, backgroundColor: '#f3f4f6', padding: 8 },
  tableCol: { width: "33.33%", borderStyle: "solid", borderBottomWidth: 1, borderRightWidth: 1, padding: 8 },
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
          <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Fecha de Entrega</Text></View>
          <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Elemento (EPP)</Text></View>
          <View style={styles.tableColHeader}><Text style={styles.tableCellHeader}>Entregado por</Text></View>
        </View>
        {data.map((row, i) => (
          <View key={i} style={styles.tableRow}>
            <View style={styles.tableCol}><Text style={styles.tableCell}>{row.delivery_date}</Text></View>
            <View style={styles.tableCol}><Text style={styles.tableCell}>{row.epp_name}</Text></View>
            <View style={styles.tableCol}><Text style={styles.tableCell}>{row.delivered_by_user_name || 'Sistema'}</Text></View>
          </View>
        ))}
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
              <PDFViewer width="100%" height="100%" className="border-0">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}