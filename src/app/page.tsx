import DepartmentList from '@/components/department-list';

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex-1">
        <DepartmentList />
      </main>
    </div>
  );
}
