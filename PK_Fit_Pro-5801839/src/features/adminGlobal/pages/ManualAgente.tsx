import React from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import { adminGlobalMenuItems as menuItems } from '../../../shared/config/adminGlobalMenu';
import '../styles/dashboard.css';

export default function ManualAgente() {
    return (
        <DashboardLayout title="Manual do PK Fit Agent" menuItems={menuItems}>
            <div className="admin-global-dashboard" style={{ maxWidth: '900px', margin: '0 auto' }}>
                
                <div className="dashboard-section" style={{ marginBottom: 'var(--spacing-6)' }}>
                    <div className="section-header">
                        <h2 className="section-title">O que é o PK Fit Agent?</h2>
                    </div>
                    <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                        O <strong>PK Fit Agent</strong> é um aplicativo que roda no computador da academia (na recepção) para fazer a ponte entre nosso sistema na nuvem (o painel web) e a catraca física de reconhecimento facial (como as da Control iD). Ele recebe a ordem de liberar a catraca remotamente, sincroniza as fotos dos alunos e garante que os check-ins sejam computados na tela em tempo real.
                    </p>
                </div>

                <div className="dashboard-section" style={{ marginBottom: 'var(--spacing-6)' }}>
                    <div className="section-header">
                        <h2 className="section-title" style={{ color: 'var(--primary-600)' }}>Passo 1: Instalação e Pareamento</h2>
                    </div>
                    <div style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                        <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <li>Acesse o <strong>Dashboard</strong> do Admin Global daqui do sistema e baixe o instalador <code>(.exe)</code>.</li>
                            <li>No computador responsável por conectar com a catraca, execute o instalador.</li>
                            <li>Ao abrir, o Agente pedirá um <strong>Código de Pareamento</strong>.</li>
                            <li>Você pode gerar esse código no painel da academia correspondente (na aba de Controle de Acesso) e colar no Agente para realizar o vínculo de segurança automaticamente.</li>
                        </ol>
                    </div>
                </div>

                <div className="dashboard-section" style={{ marginBottom: 'var(--spacing-6)' }}>
                    <div className="section-header">
                        <h2 className="section-title" style={{ color: 'var(--primary-600)' }}>Passo 2: Configuração de IP e Porta</h2>
                    </div>
                    <div style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                        <p style={{ marginBottom: '12px' }}>
                            Assim que a catraca da academia for instalada pela primeira vez na rede de internet local (na porta LAN do roteador), ela receberá um <strong>Endereço de IP</strong> na rede local. Você deve preencher o painel com as seguintes informações:
                        </p>
                        <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', marginBottom: '12px' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>Endereço IP:</strong> É literalmente o endereço da catraca no Wi-Fi ou Cabo da academia. Normalmente se parece com <code>192.168.0.100</code> ou similar. (Você acha ele nas configurações de rede direto pelo visor touch da própria catraca).
                        </div>
                        <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>Porta:</strong> Refere-se à porta de comunicação pela rede. A menos que a equipe de infraestrutura da academia tenha feito regras complexas de roteamento, o padrão para quase todas as marcas (Control iD, TopData, etc) é sempre a porta <code>80</code>.
                        </div>
                    </div>
                </div>

                <div className="dashboard-section" style={{ borderLeft: '4px solid var(--warning-500)' }}>
                    <div className="section-header">
                        <h2 className="section-title" style={{ color: 'var(--warning-600)' }}>Passo 3: Usuário e Senha (A Maior Dúvida!)</h2>
                    </div>
                    <div style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                        <p style={{ marginBottom: '12px' }}>
                            Este é um ponto que cria muita confusão em novas configurações de catraca: <strong>Este usuário e senha NÃO É do nosso sistema PK Fit Pro!</strong> Nós não enviamos uma credencial web para ele!
                        </p>
                        <p>
                            Imagine a catraca da parede como um míni-computador. Pra você entrar nas configurações exclusivas dela (via IP no navegador Chrome local, por exemplo), ela costuma pedir um "Usuário" e "Senha" da fabricante (exemplo: login na web da Control iD).
                        </p>
                        <ul style={{ paddingLeft: '20px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <li><strong>Se a academia colocou uma senha no painel da marca da catraca:</strong> Insira ela aqui. O Agente usará isso como "crachá" técnico para ter permissão interna pra subir as fotos do PK Fit lá pra dentro.</li>
                            <li><strong>Se a catraca nunca teve senha nativa criada ou usa configuração de fábrica:</strong> Os campos podem normalmente ficar vazios (ou use <code>admin</code>/<code>admin</code> que é de fábrica na maioria das marcas).</li>
                        </ul>
                    </div>
                </div>

            </div>
        </DashboardLayout>
    );
}
