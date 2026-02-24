import './globals.css';
export const metadata = { title: 'Slotify', description: 'Gestión de citas' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
