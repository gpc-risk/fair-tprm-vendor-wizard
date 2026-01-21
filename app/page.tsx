import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Download, FileText } from "lucide-react";

// Exports
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * FAIR TPRM Vendor Profile Wizard
 * - Guided, step-by-step capture of vendor profile + FAIR scenario scaffolding
 * - Exports: Excel (multi-sheet) + PDF (executive-style report)
 *
 * Notes:
 * - This is a learning module UI, not a Monte Carlo engine.
 * - It captures the inputs and results learners produce during the course.
 */

const uid = () => Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);

const money = (n) => {
  if (n === "" || n === null || n === undefined) return "";
  const x = Number(n);
  if (Number.isNaN(x)) return String(n);
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(x);
};

const emptyVendor = () => ({
  vendorId: "V-" + Date.now().toString().slice(-6),
  vendorName: "",
  category: "SaaS",
  businessOwner: "",
  criticalFunction: "",
  dataTypes: "",
  geography: "EU",
  contractStatus: "Active",
  contractStart: "",
  contractEnd: "",
});

const emptyScenario = () => ({
  scenarioId: "S-" + Date.now().toString().slice(-6),
  vendorName: "",
  assetAtRisk: "",
  threatActor: "External cybercriminal",
  threatEvent: "",
  lossEvent: "",
  primaryLossTypes: "",
  secondaryLossTypes: "",
  description: "",
});

const emptyInputs = (scenarioId) => ({
  scenarioId,
  tefLow: "",
  tefHigh: "",
  vulnLow: "",
  vulnHigh: "",
  lmPrimary: "",
  lmSecondary: "",
  assumptions: "",
});

const emptyResults = (scenarioId) => ({
  scenarioId,
  expectedAnnualLoss: "",
  p90: "",
  p95: "",
  drivers: "",
});

const emptyTreatment = (scenarioId) => ({
  id: uid(),
  scenarioId,
  control: "",
  annualCost: "",
  annualRiskReduction: "",
  residualRisk: "",
  owner: "",
});

const emptyDecision = (scenarioId) => ({
  id: uid(),
  scenarioId,
  decision: "Reduce",
  rationale: "",
  approvedBy: "",
  decisionDate: "",
  nextReview: "",
});

function StepHeader({ title, subtitle, step, total }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm text-muted-foreground">Step {step} of {total}</div>
        <h2 className="text-2xl font-semibold leading-tight">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground max-w-3xl">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function Hint({ children }) {
  return (
    <div className="mt-3 rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export default function FAIRTPRMVendorProfileWizard() {
  const totalSteps = 6;
  const [step, setStep] = useState(1);

  const [vendor, setVendor] = useState(emptyVendor());
  const [scenarios, setScenarios] = useState([emptyScenario()]);

  // keyed by scenarioId
  const [inputsByScenario, setInputsByScenario] = useState({});
  const [resultsByScenario, setResultsByScenario] = useState({});
  const [treatments, setTreatments] = useState([]);
  const [decisions, setDecisions] = useState([]);

  const currentScenarioIds = useMemo(() => scenarios.map((s) => s.scenarioId), [scenarios]);

  // Ensure vendorName propagates to scenarios if empty
  const propagateVendorName = (name) => {
    setScenarios((prev) => prev.map((s) => ({ ...s, vendorName: s.vendorName || name })));
  };

  const addScenario = () => {
    const s = emptyScenario();
    s.vendorName = vendor.vendorName || "";
    setScenarios((prev) => [...prev, s]);
  };

  const removeScenario = (scenarioId) => {
    setScenarios((prev) => prev.filter((s) => s.scenarioId !== scenarioId));
    setInputsByScenario((prev) => {
      const next = { ...prev };
      delete next[scenarioId];
      return next;
    });
    setResultsByScenario((prev) => {
      const next = { ...prev };
      delete next[scenarioId];
      return next;
    });
    setTreatments((prev) => prev.filter((t) => t.scenarioId !== scenarioId));
    setDecisions((prev) => prev.filter((d) => d.scenarioId !== scenarioId));
  };

  const upsertInputs = (scenarioId, patch) => {
    setInputsByScenario((prev) => ({
      ...prev,
      [scenarioId]: { ...(prev[scenarioId] || emptyInputs(scenarioId)), ...patch },
    }));
  };

  const upsertResults = (scenarioId, patch) => {
    setResultsByScenario((prev) => ({
      ...prev,
      [scenarioId]: { ...(prev[scenarioId] || emptyResults(scenarioId)), ...patch },
    }));
  };

  const addTreatment = (scenarioId) => {
    setTreatments((prev) => [...prev, emptyTreatment(scenarioId)]);
  };

  const updateTreatment = (id, patch) => {
    setTreatments((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const removeTreatment = (id) => {
    setTreatments((prev) => prev.filter((t) => t.id !== id));
  };

  const addDecision = (scenarioId) => {
    // one decision per scenario by default
    setDecisions((prev) => {
      const exists = prev.some((d) => d.scenarioId === scenarioId);
      return exists ? prev : [...prev, emptyDecision(scenarioId)];
    });
  };

  const updateDecision = (id, patch) => {
    setDecisions((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Vendor Overview
    const vendorSheet = XLSX.utils.json_to_sheet([
      {
        "Vendor ID": vendor.vendorId,
        "Vendor Name": vendor.vendorName,
        "Vendor Category": vendor.category,
        "Business Owner": vendor.businessOwner,
        "Critical Business Function": vendor.criticalFunction,
        "Data Types Accessed": vendor.dataTypes,
        "Geographical Scope": vendor.geography,
        "Contract Status": vendor.contractStatus,
        "Contract Start Date": vendor.contractStart,
        "Contract End Date": vendor.contractEnd,
      },
    ]);
    XLSX.utils.book_append_sheet(wb, vendorSheet, "Vendor Overview");

    // Risk Scenarios
    const scenarioRows = scenarios.map((s) => ({
      "Scenario ID": s.scenarioId,
      "Vendor Name": s.vendorName,
      "Asset at Risk": s.assetAtRisk,
      "Threat Actor": s.threatActor,
      "Threat Event": s.threatEvent,
      "Loss Event": s.lossEvent,
      "Primary Loss Types": s.primaryLossTypes,
      "Secondary Loss Types": s.secondaryLossTypes,
      "Scenario Description": s.description,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scenarioRows), "Risk Scenarios");

    // FAIR Inputs
    const inputRows = scenarios.map((s) => {
      const i = inputsByScenario[s.scenarioId] || emptyInputs(s.scenarioId);
      return {
        "Scenario ID": s.scenarioId,
        "Threat Event Frequency (Low)": i.tefLow,
        "Threat Event Frequency (High)": i.tefHigh,
        "Susceptibility (Low)": i.vulnLow,
        "Susceptibility (High)": i.vulnHigh,
        "Loss Magnitude Primary": i.lmPrimary,
        "Loss Magnitude Secondary": i.lmSecondary,
        "Key Assumptions": i.assumptions,
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inputRows), "FAIR Inputs");

    // FAIR Results
    const resultRows = scenarios.map((s) => {
      const r = resultsByScenario[s.scenarioId] || emptyResults(s.scenarioId);
      return {
        "Scenario ID": s.scenarioId,
        "Expected Annual Loss": r.expectedAnnualLoss,
        "90th Percentile": r.p90,
        "95th Percentile": r.p95,
        "Key Risk Drivers": r.drivers,
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resultRows), "FAIR Results");

    // Treatment Options
    const treatmentRows = treatments.map((t) => ({
      "Scenario ID": t.scenarioId,
      "Proposed Control": t.control,
      "Estimated Annual Cost": t.annualCost,
      "Estimated Annual Risk Reduction": t.annualRiskReduction,
      "Residual Risk": t.residualRisk,
      "Implementation Owner": t.owner,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(treatmentRows), "Treatment Options");

    // Decision Log
    const decisionRows = decisions.map((d) => ({
      "Scenario ID": d.scenarioId,
      Decision: d.decision,
      Rationale: d.rationale,
      "Approved By": d.approvedBy,
      "Decision Date": d.decisionDate,
      "Next Review Date": d.nextReview,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(decisionRows), "Decision Log");

    XLSX.writeFile(wb, `FAIR_TPRM_Vendor_Profile_${vendor.vendorName || "Vendor"}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const title = "FAIR-Based TPRM Vendor Report";
    const subtitle = vendor.vendorName ? `Vendor: ${vendor.vendorName}` : "Vendor";

    doc.setFontSize(18);
    doc.text(title, 40, 50);
    doc.setFontSize(11);
    doc.setTextColor(90);
    doc.text(subtitle, 40, 70);
    doc.setTextColor(0);

    // Vendor summary
    doc.setFontSize(13);
    doc.text("1. Vendor Overview", 40, 105);

    const vendorOverview = [
      ["Vendor Category", vendor.category],
      ["Business Owner", vendor.businessOwner],
      ["Critical Function", vendor.criticalFunction],
      ["Data Types", vendor.dataTypes],
      ["Geography", vendor.geography],
      ["Contract Status", vendor.contractStatus],
      ["Contract Dates", `${vendor.contractStart || ""} to ${vendor.contractEnd || ""}`.trim()],
    ];

    autoTable(doc, {
      startY: 120,
      head: [["Field", "Value"]],
      body: vendorOverview,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 41, 59] },
      margin: { left: 40, right: 40 },
    });

    let y = doc.lastAutoTable.finalY + 22;

    doc.setFontSize(13);
    doc.text("2. Key Metrics and Insights", 40, y);
    y += 10;

    const resultRows = scenarios.map((s) => {
      const r = resultsByScenario[s.scenarioId] || emptyResults(s.scenarioId);
      return [
        s.scenarioId,
        s.lossEvent || s.threatEvent || "Scenario",
        r.expectedAnnualLoss || "",
        r.p90 || "",
        r.p95 || "",
      ];
    });

    autoTable(doc, {
      startY: y + 10,
      head: [["Scenario", "Title", "Expected Loss", "P90", "P95"]],
      body: resultRows,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 41, 59] },
      margin: { left: 40, right: 40 },
    });

    y = doc.lastAutoTable.finalY + 22;

    doc.setFontSize(13);
    doc.text("3. Treatment Recommendations", 40, y);
    y += 10;

    const tRows = treatments.map((t) => {
      const scenarioTitle = scenarios.find((s) => s.scenarioId === t.scenarioId)?.lossEvent || "";
      return [
        t.scenarioId,
        scenarioTitle,
        t.control,
        t.annualCost,
        t.annualRiskReduction,
        t.residualRisk,
      ];
    });

    autoTable(doc, {
      startY: y + 10,
      head: [["Scenario", "Scenario", "Control", "Cost", "Risk Reduction", "Residual Risk"]],
      body: tRows.length ? tRows : [["-", "-", "No treatments captured", "", "", ""]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
      margin: { left: 40, right: 40 },
    });

    y = doc.lastAutoTable.finalY + 22;

    doc.setFontSize(13);
    doc.text("4. Decision Log", 40, y);

    const dRows = decisions.map((d) => [
      d.scenarioId,
      d.decision,
      d.approvedBy,
      d.decisionDate,
      d.nextReview,
      d.rationale,
    ]);

    autoTable(doc, {
      startY: y + 10,
      head: [["Scenario", "Decision", "Approved By", "Decision Date", "Next Review", "Rationale"]],
      body: dRows.length ? dRows : [["-", "-", "", "", "", "No decisions captured"]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
      margin: { left: 40, right: 40 },
    });

    doc.save(`FAIR_TPRM_Report_${vendor.vendorName || "Vendor"}.pdf`);
  };

  const canContinue = () => {
    if (step === 1) return Boolean(vendor.vendorName.trim());
    if (step === 2) return scenarios.length > 0;
    return true;
  };

  const stepCard = (content) => (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-6">{content}</CardContent>
    </Card>
  );

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Guided module</div>
          <h1 className="text-3xl font-bold tracking-tight">FAIR TPRM Vendor Profile</h1>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Capture vendor context, define FAIR-aligned scenarios, document inputs and outcomes, and export a board-friendly report.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportExcel} className="rounded-2xl">
            <Download className="mr-2 h-4 w-4" /> Export Excel
          </Button>
          <Button onClick={exportPDF} className="rounded-2xl">
            <FileText className="mr-2 h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      <Separator />

      <Tabs value={String(step)} onValueChange={(v) => setStep(Number(v))}>
        <TabsList className="grid grid-cols-3 md:grid-cols-6 gap-2 bg-transparent">
          {[1,2,3,4,5,6].map((n) => (
            <TabsTrigger key={n} value={String(n)} className="rounded-2xl data-[state=active]:shadow-sm">
              Step {n}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="1" className="mt-6">
          {stepCard(
            <div className="space-y-6">
              <StepHeader
                step={1}
                total={totalSteps}
                title="Vendor Overview"
                subtitle="Capture business context first. If you cannot explain why this vendor matters, you are not ready to quantify risk."
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vendor Name</Label>
                  <Input
                    value={vendor.vendorName}
                    onChange={(e) => {
                      setVendor((v) => ({ ...v, vendorName: e.target.value }));
                      propagateVendorName(e.target.value);
                    }}
                    placeholder="Example: CloudCRM Inc."
                    className="rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vendor Category</Label>
                  <Input
                    value={vendor.category}
                    onChange={(e) => setVendor((v) => ({ ...v, category: e.target.value }))}
                    placeholder="SaaS, MSP, Cloud, Payment, ..."
                    className="rounded-2xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Business Owner</Label>
                  <Input
                    value={vendor.businessOwner}
                    onChange={(e) => setVendor((v) => ({ ...v, businessOwner: e.target.value }))}
                    placeholder="Name / function"
                    className="rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Critical Business Function Supported</Label>
                  <Input
                    value={vendor.criticalFunction}
                    onChange={(e) => setVendor((v) => ({ ...v, criticalFunction: e.target.value }))}
                    placeholder="Example: Customer acquisition and retention"
                    className="rounded-2xl"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Data Types Accessed or Processed</Label>
                  <Textarea
                    value={vendor.dataTypes}
                    onChange={(e) => setVendor((v) => ({ ...v, dataTypes: e.target.value }))}
                    placeholder="Example: Customer PII, order history, support tickets"
                    className="rounded-2xl min-h-[90px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Geographical Scope</Label>
                  <Input
                    value={vendor.geography}
                    onChange={(e) => setVendor((v) => ({ ...v, geography: e.target.value }))}
                    placeholder="EU, Global, US, ..."
                    className="rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contract Status</Label>
                  <Input
                    value={vendor.contractStatus}
                    onChange={(e) => setVendor((v) => ({ ...v, contractStatus: e.target.value }))}
                    placeholder="Active, Pending, Renewal, ..."
                    className="rounded-2xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Contract Start</Label>
                  <Input value={vendor.contractStart} onChange={(e) => setVendor((v) => ({ ...v, contractStart: e.target.value }))} placeholder="YYYY-MM-DD" className="rounded-2xl" />
                </div>
                <div className="space-y-2">
                  <Label>Contract End</Label>
                  <Input value={vendor.contractEnd} onChange={(e) => setVendor((v) => ({ ...v, contractEnd: e.target.value }))} placeholder="YYYY-MM-DD" className="rounded-2xl" />
                </div>
              </div>

              <Hint>
                <div className="font-medium text-foreground">Guidance</div>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Write the vendor description so a business leader would agree with it.</li>
                  <li>If you cannot name the critical function and data types, stop here and gather facts.</li>
                </ul>
              </Hint>
            </div>
          )}
        </TabsContent>

        <TabsContent value="2" className="mt-6">
          {stepCard(
            <div className="space-y-6">
              <StepHeader
                step={2}
                total={totalSteps}
                title="Risk Scenarios"
                subtitle="Define complete scenarios. No tiers, no generic risk statements."
              />

              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-2xl">{scenarios.length} scenario(s)</Badge>
                  <span className="text-sm text-muted-foreground">Keep it to 1 to 3 high-impact scenarios per vendor.</span>
                </div>
                <Button onClick={addScenario} className="rounded-2xl">
                  <Plus className="mr-2 h-4 w-4" /> Add scenario
                </Button>
              </div>

              <div className="space-y-4">
                {scenarios.map((s, idx) => (
                  <Card key={s.scenarioId} className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">Scenario {idx + 1} <span className="text-muted-foreground font-normal">({s.scenarioId})</span></CardTitle>
                          <div className="text-sm text-muted-foreground">Define threat, asset, and loss in plain language.</div>
                        </div>
                        {scenarios.length > 1 ? (
                          <Button variant="ghost" onClick={() => removeScenario(s.scenarioId)} className="rounded-2xl">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Vendor Name</Label>
                          <Input value={s.vendorName} onChange={(e) => setScenarios((prev) => prev.map((x) => x.scenarioId === s.scenarioId ? { ...x, vendorName: e.target.value } : x))} className="rounded-2xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Asset at Risk</Label>
                          <Input value={s.assetAtRisk} onChange={(e) => setScenarios((prev) => prev.map((x) => x.scenarioId === s.scenarioId ? { ...x, assetAtRisk: e.target.value } : x))} placeholder="Example: Customer PII in CRM" className="rounded-2xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Threat Actor</Label>
                          <Input value={s.threatActor} onChange={(e) => setScenarios((prev) => prev.map((x) => x.scenarioId === s.scenarioId ? { ...x, threatActor: e.target.value } : x))} placeholder="External cybercriminal, insider, competitor" className="rounded-2xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Threat Event</Label>
                          <Input value={s.threatEvent} onChange={(e) => setScenarios((prev) => prev.map((x) => x.scenarioId === s.scenarioId ? { ...x, threatEvent: e.target.value } : x))} placeholder="Example: Credential compromise" className="rounded-2xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Loss Event</Label>
                          <Input value={s.lossEvent} onChange={(e) => setScenarios((prev) => prev.map((x) => x.scenarioId === s.scenarioId ? { ...x, lossEvent: e.target.value } : x))} placeholder="Example: Unauthorized data exfiltration" className="rounded-2xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Primary Loss Types</Label>
                          <Input value={s.primaryLossTypes} onChange={(e) => setScenarios((prev) => prev.map((x) => x.scenarioId === s.scenarioId ? { ...x, primaryLossTypes: e.target.value } : x))} placeholder="Response, replacement, productivity, fines" className="rounded-2xl" />
                        </div>
                        <div className="space-y-2">
                          <Label>Secondary Loss Types</Label>
                          <Input value={s.secondaryLossTypes} onChange={(e) => setScenarios((prev) => prev.map((x) => x.scenarioId === s.scenarioId ? { ...x, secondaryLossTypes: e.target.value } : x))} placeholder="Regulatory, legal, reputation" className="rounded-2xl" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Scenario Description</Label>
                          <Textarea value={s.description} onChange={(e) => setScenarios((prev) => prev.map((x) => x.scenarioId === s.scenarioId ? { ...x, description: e.target.value } : x))} placeholder="Short narrative: what happens, who is affected, and why it matters." className="rounded-2xl min-h-[90px]" />
                        </div>
                      </div>

                      <Hint>
                        <div className="font-medium text-foreground">Scenario quality checks</div>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                          <li>If you removed the vendor name, would the scenario still make sense? If yes, it is too generic.</li>
                          <li>If you cannot name the asset at risk, you cannot quantify loss.</li>
                        </ul>
                      </Hint>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="3" className="mt-6">
          {stepCard(
            <div className="space-y-6">
              <StepHeader
                step={3}
                total={totalSteps}
                title="FAIR Inputs"
                subtitle="Document ranges and assumptions. The goal is transparency, not false precision."
              />

              <div className="space-y-4">
                {scenarios.map((s) => {
                  const i = inputsByScenario[s.scenarioId] || emptyInputs(s.scenarioId);
                  return (
                    <Card key={s.scenarioId} className="rounded-2xl">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{s.scenarioId}</CardTitle>
                            <div className="text-sm text-muted-foreground">{s.lossEvent || s.threatEvent || "Scenario"}</div>
                          </div>
                          <Badge className="rounded-2xl" variant="secondary">Inputs</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Threat Event Frequency (Low, per year)</Label>
                            <Input value={i.tefLow} onChange={(e) => upsertInputs(s.scenarioId, { tefLow: e.target.value })} placeholder="Example: 1" className="rounded-2xl" />
                          </div>
                          <div className="space-y-2">
                            <Label>Threat Event Frequency (High, per year)</Label>
                            <Input value={i.tefHigh} onChange={(e) => upsertInputs(s.scenarioId, { tefHigh: e.target.value })} placeholder="Example: 6" className="rounded-2xl" />
                          </div>
                          <div className="space-y-2">
                            <Label>Susceptibility (Low, %)</Label>
                            <Input value={i.vulnLow} onChange={(e) => upsertInputs(s.scenarioId, { vulnLow: e.target.value })} placeholder="Example: 5" className="rounded-2xl" />
                          </div>
                          <div className="space-y-2">
                            <Label>Susceptibility (High, %)</Label>
                            <Input value={i.vulnHigh} onChange={(e) => upsertInputs(s.scenarioId, { vulnHigh: e.target.value })} placeholder="Example: 25" className="rounded-2xl" />
                          </div>
                          <div className="space-y-2">
                            <Label>Loss Magnitude Primary (Typical €)</Label>
                            <Input value={i.lmPrimary} onChange={(e) => upsertInputs(s.scenarioId, { lmPrimary: e.target.value })} placeholder="Example: 250000" className="rounded-2xl" />
                          </div>
                          <div className="space-y-2">
                            <Label>Loss Magnitude Secondary (Typical €)</Label>
                            <Input value={i.lmSecondary} onChange={(e) => upsertInputs(s.scenarioId, { lmSecondary: e.target.value })} placeholder="Example: 500000" className="rounded-2xl" />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>Key Assumptions</Label>
                            <Textarea value={i.assumptions} onChange={(e) => upsertInputs(s.scenarioId, { assumptions: e.target.value })} placeholder="Document what you assumed and why. Example: log review weekly, detection 7-14 days, notification SLA 72h." className="rounded-2xl min-h-[90px]" />
                          </div>
                        </div>

                        <Hint>
                          <div className="font-medium text-foreground">Guidance</div>
                          <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Use ranges (low to high) when you are uncertain. Uncertainty is normal.</li>
                            <li>Assumptions must be readable by someone outside security.</li>
                          </ul>
                        </Hint>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="4" className="mt-6">
          {stepCard(
            <div className="space-y-6">
              <StepHeader
                step={4}
                total={totalSteps}
                title="FAIR Results"
                subtitle="Capture outputs in decision language. The point is comparability and prioritization."
              />

              <div className="space-y-4">
                {scenarios.map((s) => {
                  const r = resultsByScenario[s.scenarioId] || emptyResults(s.scenarioId);
                  return (
                    <Card key={s.scenarioId} className="rounded-2xl">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{s.scenarioId}</CardTitle>
                            <div className="text-sm text-muted-foreground">{s.lossEvent || s.threatEvent || "Scenario"}</div>
                          </div>
                          <Badge className="rounded-2xl" variant="secondary">Results</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Expected Annual Loss (€)</Label>
                            <Input value={r.expectedAnnualLoss} onChange={(e) => upsertResults(s.scenarioId, { expectedAnnualLoss: e.target.value })} placeholder="Example: 420000" className="rounded-2xl" />
                          </div>
                          <div className="space-y-2">
                            <Label>90th Percentile (€)</Label>
                            <Input value={r.p90} onChange={(e) => upsertResults(s.scenarioId, { p90: e.target.value })} placeholder="Example: 1600000" className="rounded-2xl" />
                          </div>
                          <div className="space-y-2">
                            <Label>95th Percentile (€)</Label>
                            <Input value={r.p95} onChange={(e) => upsertResults(s.scenarioId, { p95: e.target.value })} placeholder="Example: 2400000" className="rounded-2xl" />
                          </div>
                          <div className="space-y-2 md:col-span-3">
                            <Label>Key Risk Drivers (plain language)</Label>
                            <Textarea value={r.drivers} onChange={(e) => upsertResults(s.scenarioId, { drivers: e.target.value })} placeholder="Example: weak privileged access controls, slow detection, high data volume, regulatory exposure." className="rounded-2xl min-h-[80px]" />
                          </div>
                        </div>

                        <Hint>
                          <div className="font-medium text-foreground">Guidance</div>
                          <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Use the 90th percentile as a realistic worst-case anchor for executives.</li>
                            <li>Drivers should explain what moves the result, not list controls.</li>
                          </ul>
                        </Hint>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="5" className="mt-6">
          {stepCard(
            <div className="space-y-6">
              <StepHeader
                step={5}
                total={totalSteps}
                title="Treatment Options"
                subtitle="Translate controls into measurable risk reduction. If you cannot quantify impact, you cannot justify investment."
              />

              <div className="space-y-4">
                {scenarios.map((s) => (
                  <Card key={s.scenarioId} className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <CardTitle className="text-lg">{s.scenarioId}</CardTitle>
                          <div className="text-sm text-muted-foreground">{s.lossEvent || s.threatEvent || "Scenario"}</div>
                        </div>
                        <Button variant="outline" onClick={() => addTreatment(s.scenarioId)} className="rounded-2xl">
                          <Plus className="mr-2 h-4 w-4" /> Add treatment
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Control</TableHead>
                            <TableHead>Annual Cost (€)</TableHead>
                            <TableHead>Annual Risk Reduction (€)</TableHead>
                            <TableHead>Residual Risk (€)</TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {treatments.filter((t) => t.scenarioId === s.scenarioId).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-muted-foreground">No treatments captured yet.</TableCell>
                            </TableRow>
                          ) : null}
                          {treatments
                            .filter((t) => t.scenarioId === s.scenarioId)
                            .map((t) => (
                              <TableRow key={t.id}>
                                <TableCell>
                                  <Input value={t.control} onChange={(e) => updateTreatment(t.id, { control: e.target.value })} className="rounded-2xl" placeholder="Example: Enforce MFA for vendor admins" />
                                </TableCell>
                                <TableCell>
                                  <Input value={t.annualCost} onChange={(e) => updateTreatment(t.id, { annualCost: e.target.value })} className="rounded-2xl" placeholder="40000" />
                                </TableCell>
                                <TableCell>
                                  <Input value={t.annualRiskReduction} onChange={(e) => updateTreatment(t.id, { annualRiskReduction: e.target.value })} className="rounded-2xl" placeholder="150000" />
                                </TableCell>
                                <TableCell>
                                  <Input value={t.residualRisk} onChange={(e) => updateTreatment(t.id, { residualRisk: e.target.value })} className="rounded-2xl" placeholder="230000" />
                                </TableCell>
                                <TableCell>
                                  <Input value={t.owner} onChange={(e) => updateTreatment(t.id, { owner: e.target.value })} className="rounded-2xl" placeholder="Vendor manager" />
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button variant="ghost" onClick={() => removeTreatment(t.id)} className="rounded-2xl">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>

                      <Hint>
                        <div className="font-medium text-foreground">Guidance</div>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                          <li>Use annualized cost and annualized risk reduction so ROI is comparable.</li>
                          <li>Residual risk should remain, otherwise the control claim is not credible.</li>
                        </ul>
                      </Hint>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="6" className="mt-6">
          {stepCard(
            <div className="space-y-6">
              <StepHeader
                step={6}
                total={totalSteps}
                title="Decisions"
                subtitle="Document explicit decisions. If you cannot name the decision owner, you do not have governance."
              />

              <div className="space-y-4">
                {scenarios.map((s) => {
                  const decision = decisions.find((d) => d.scenarioId === s.scenarioId);
                  return (
                    <Card key={s.scenarioId} className="rounded-2xl">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <CardTitle className="text-lg">{s.scenarioId}</CardTitle>
                            <div className="text-sm text-muted-foreground">{s.lossEvent || s.threatEvent || "Scenario"}</div>
                          </div>
                          {!decision ? (
                            <Button variant="outline" onClick={() => addDecision(s.scenarioId)} className="rounded-2xl">
                              <Plus className="mr-2 h-4 w-4" /> Add decision
                            </Button>
                          ) : (
                            <Badge className="rounded-2xl" variant="secondary">Decision recorded</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {!decision ? (
                          <div className="text-sm text-muted-foreground">No decision captured yet.</div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Decision</Label>
                              <Input value={decision.decision} onChange={(e) => updateDecision(decision.id, { decision: e.target.value })} className="rounded-2xl" placeholder="Accept, Reduce, Transfer, Avoid" />
                            </div>
                            <div className="space-y-2">
                              <Label>Approved By</Label>
                              <Input value={decision.approvedBy} onChange={(e) => updateDecision(decision.id, { approvedBy: e.target.value })} className="rounded-2xl" placeholder="CISO, CIO, Business owner" />
                            </div>
                            <div className="space-y-2">
                              <Label>Decision Date</Label>
                              <Input value={decision.decisionDate} onChange={(e) => updateDecision(decision.id, { decisionDate: e.target.value })} className="rounded-2xl" placeholder="YYYY-MM-DD" />
                            </div>
                            <div className="space-y-2">
                              <Label>Next Review</Label>
                              <Input value={decision.nextReview} onChange={(e) => updateDecision(decision.id, { nextReview: e.target.value })} className="rounded-2xl" placeholder="YYYY-MM-DD" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label>Rationale</Label>
                              <Textarea value={decision.rationale} onChange={(e) => updateDecision(decision.id, { rationale: e.target.value })} className="rounded-2xl min-h-[90px]" placeholder="Why this decision is acceptable given the results and business context." />
                            </div>
                          </div>
                        )}

                        <Hint>
                          <div className="font-medium text-foreground">Guidance</div>
                          <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>A decision without an owner is not a decision.</li>
                            <li>Write the rationale so it can be audited later.</li>
                          </ul>
                        </Hint>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground">
          {vendor.vendorName ? (
            <span>Working on <span className="text-foreground font-medium">{vendor.vendorName}</span></span>
          ) : (
            <span>Enter a vendor name to get started.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="rounded-2xl"
          >
            Back
          </Button>
          <Button
            onClick={() => setStep((s) => Math.min(totalSteps, s + 1))}
            disabled={step === totalSteps || !canContinue()}
            className="rounded-2xl"
          >
            Next
          </Button>
        </div>
      </div>

      <div className="pt-4 text-xs text-muted-foreground">
        Tip: Use this module during training to capture a single vendor end-to-end. Export the PDF as the final deliverable.
      </div>
    </div>
  );
}
