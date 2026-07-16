export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 bg-[#f7f8f9]  flex flex-col items-center justify-center px-6 py-12 min-h-screen overflow-y-auto">
      {children}
    </div>
  );
}
