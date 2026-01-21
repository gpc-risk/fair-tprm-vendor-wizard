export const metadata = {
  title: "FAIR TPRM Vendor Wizard",
  description: "Guided FAIR-based Third Party Risk Management tool"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Inter, Arial, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
