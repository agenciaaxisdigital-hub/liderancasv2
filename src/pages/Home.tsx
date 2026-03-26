import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav, { type TabId } from '@/components/BottomNav';
import TabCadastrar from '@/components/TabCadastrar';
import TabLiderancas from '@/components/TabLiderancas';
import TabPerfil from '@/components/TabPerfil';

const tabTitles: Record<TabId, string> = {
  cadastrar: 'Nova Liderança',
  liderancas: 'Lideranças',
  perfil: 'Perfil',
};

export default function Home() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('cadastrar');
  const [refreshKey, setRefreshKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const handleSaved = () => {
    setRefreshKey(k => k + 1);
    setActiveTab('liderancas');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Gradient top bar */}
      <div className="h-[1.5px] gradient-header shrink-0" />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border shrink-0">
        <div className="max-w-[672px] mx-auto px-4 py-3">
          <h1 className="text-xl font-bold text-foreground">
            {activeTab === 'liderancas'
              ? (isAdmin ? 'Todas as Lideranças' : 'Minhas Lideranças')
              : tabTitles[activeTab]}
          </h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">Rede política – Dra. Fernanda Sarelli</p>
        </div>
      </header>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[672px] mx-auto px-4 py-4">
          {activeTab === 'cadastrar' && <TabCadastrar onSaved={handleSaved} />}
          {activeTab === 'liderancas' && <TabLiderancas refreshKey={refreshKey} />}
          {activeTab === 'perfil' && <TabPerfil />}
        </div>
      </div>

      <BottomNav active={activeTab} onChange={handleTabChange} />
    </div>
  );
}
