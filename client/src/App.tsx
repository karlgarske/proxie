import { useHello } from '@/hooks/useHello';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export function App() {
  const { data, isLoading, error, refetch } = useHello();
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Simple Web App</h1>
      <div className="space-x-2">
        <Link to="/hello" className="underline">
          Go to /hello
        </Link>
        <Button onClick={() => refetch()}>Fetch /api/hello</Button>
      </div>
      <div className="p-4 rounded-md border">
        {isLoading && <p>Loading…</p>}
        {error && <p className="text-red-600">Error: {(error as Error).message}</p>}
        {data && (
          <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}

