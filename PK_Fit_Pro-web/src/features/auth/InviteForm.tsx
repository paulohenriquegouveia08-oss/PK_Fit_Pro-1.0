import { useState, type FormEvent } from 'react';
import { redeemInviteCode, type ValidateInviteResult } from '../../shared/services/invite.service';

interface InviteFormProps {
    inviteCode: string;
    inviteData: ValidateInviteResult;
    onSuccess: (data: { user_id: string; role: string; name: string }) => void;
    onBack: () => void;
}

export default function InviteForm({ inviteCode, inviteData, onSuccess, onBack }: InviteFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Common fields
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Specific fields
    const [cnpj, setCnpj] = useState('');
    const [cref, setCref] = useState('');
    const [academyName, setAcademyName] = useState('');

    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres');
            return;
        }

        if (password !== confirmPassword) {
            setError('As senhas não coincidem');
            return;
        }

        setIsLoading(true);

        try {
            const payload: any = {
                code: inviteCode,
                name: inviteData.type === 'academy_invite' ? academyName : name, // For academy owner, the main name field is the owner's name. Actually, let's use `name` for the owner, `academyName` for the academy.
                email,
                password,
                phone,
            };

            if (inviteData.type === 'academy_invite') {
                payload.academy_data = {
                    name: academyName,
                    cnpj,
                    email,
                    phone,
                    plan_name: inviteData.metadata?.plan_name,
                    plan_value: inviteData.metadata?.plan_value,
                    student_limit: inviteData.metadata?.student_limit,
                };
            }

            if (inviteData.type === 'teacher_invite') {
                payload.cref = cref;
            }

            const result = await redeemInviteCode(payload);

            if (!result.success || !result.data) {
                setError(result.error || 'Erro ao resgatar convite');
                return;
            }

            // Successfully created account
            // Pass the user's name to onSuccess to display the welcome animation
            onSuccess({
                user_id: result.data.user_id,
                role: result.data.role,
                name: payload.name
            });
        } catch (err) {
            setError('Erro inesperado ao cadastrar. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    const isAcademy = inviteData.type === 'academy_invite';
    const isTeacher = inviteData.type === 'teacher_invite';

    return (
        <form className="login-form" onSubmit={handleSubmit}>
            <button type="button" className="back-button" onClick={onBack}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10.828 12l4.95 4.95-1.414 1.414L8 12l6.364-6.364 1.414 1.414z" />
                </svg>
                Voltar
            </button>

            {error && (
                <div className="login-alert error">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z" />
                    </svg>
                    {error}
                </div>
            )}

            {isAcademy && (
                <div className="plan-summary-box" style={{ background: 'var(--bg-secondary)', padding: 'var(--spacing-4)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--spacing-6)', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ margin: '0 0 var(--spacing-2) 0', color: 'var(--primary-color)' }}>Plano Pré-selecionado</h4>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>
                        <strong>Plano:</strong> {inviteData.metadata?.plan_name || 'Básico'}<br />
                        <strong>Limite de Alunos:</strong> {inviteData.metadata?.student_limit || 'Ilimitado'}
                    </p>
                </div>
            )}

            {isAcademy && (
                <>
                    <div className="form-group">
                        <label className="form-label" htmlFor="academyName">Nome da Academia</label>
                        <input id="academyName" type="text" className="form-input" required
                            value={academyName} onChange={(e) => setAcademyName(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="cnpj">CNPJ</label>
                        <input id="cnpj" type="text" className="form-input" required
                            value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
                    </div>
                </>
            )}

            <div className="form-group">
                <label className="form-label" htmlFor="name">Seu Nome Completo</label>
                <input id="name" type="text" className="form-input" required
                    value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {isTeacher && (
                <div className="form-group">
                    <label className="form-label" htmlFor="cref">CREF</label>
                    <input id="cref" type="text" className="form-input" required
                        value={cref} onChange={(e) => setCref(e.target.value)} />
                </div>
            )}

            <div className="form-group">
                <label className="form-label" htmlFor="email">E-mail de Acesso</label>
                <input id="email" type="email" className="form-input" required
                    value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="form-group">
                <label className="form-label" htmlFor="phone">Telefone / WhatsApp</label>
                <input id="phone" type="tel" className="form-input" required
                    value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            <div className="form-group">
                <label className="form-label" htmlFor="password">Criar Senha</label>
                <div className="password-input-wrapper">
                    <input id="password" type={showPassword ? 'text' : 'password'} className="form-input" required
                        value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button type="button" className="password-toggle-btn" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? 'Ocultar' : 'Mostrar'}
                    </button>
                </div>
            </div>

            <div className="form-group">
                <label className="form-label" htmlFor="confirmPassword">Confirmar Senha</label>
                <input id="confirmPassword" type={showPassword ? 'text' : 'password'} className="form-input" required
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>

            <button type="submit" className={`btn btn-primary btn-full ${isLoading ? 'btn-loading' : ''}`} disabled={isLoading}>
                {isLoading ? '' : 'Finalizar Cadastro'}
            </button>
        </form>
    );
}
