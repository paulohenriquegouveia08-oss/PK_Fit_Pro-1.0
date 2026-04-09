import { useState, useEffect, useRef, type FormEvent } from 'react';
import { supabase } from '../../../shared/services/supabase';
import { DashboardLayout } from '../../../shared/components/layout';
import {
    getAcademyMembers,
    getAcademyProfessors,
    createAcademyMember,
    updateAcademyMember,
    toggleMemberStatus,
    deleteAcademyMember,
    getCurrentAcademyId,
    type AcademyMember
} from '../../../shared/services/academyMember.service';
import {
    getAcademyPlans,
    createStudentPlan,
    getStudentActivePlan,
    calculateEndDate,
    formatDateBR
} from '../../../shared/services/plan.service';
import {
    markStudentPlanAsPaid,
    markStudentPlanAsUnpaid,
    getStudentPaymentStatus
} from '../../../shared/services/financial.service';
import type { User, Plan } from '../../../shared/types';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../../../features/adminGlobal/styles/academias.css';
import '../../../features/adminGlobal/styles/usuarios.css';
import { adminAcademiaMenuItems as menuItems } from '../../../shared/config/adminAcademiaMenu';

interface FormData {
    name: string;
    email: string;
    phone: string;
    professor_id: string;
    plan_id: string;
    payment_method: 'dinheiro' | 'pix' | 'credito' | 'debito' | 'pagar_depois';
    photo_url: string;
}

const initialFormData: FormData = {
    name: '',
    email: '',
    phone: '',
    professor_id: '',
    plan_id: '',
    payment_method: 'pagar_depois',
    photo_url: ''
};

// Student with plan info
interface StudentWithPlan extends AcademyMember {
    plan_name?: string;
    plan_id?: string;
    plan_start_date?: string;
    plan_end_date?: string;
    plan_has_time_restriction?: boolean;
    plan_allowed_start_time?: string;
    plan_allowed_end_time?: string;
    plan_price?: number;
    payment_status?: 'pago' | 'nao_pago';
    photo_url?: string;
}

export default function Alunos() {
    const [students, setStudents] = useState<StudentWithPlan[]>([]);
    const [professors, setProfessors] = useState<User[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProfessor, setFilterProfessor] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showRenewModal, setShowRenewModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<StudentWithPlan | null>(null);
    const [renewStudent, setRenewStudent] = useState<StudentWithPlan | null>(null);
    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [renewFormData, setRenewFormData] = useState<FormData>(initialFormData);
    const [editFormData, setEditFormData] = useState<FormData>(initialFormData);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [academyId, setAcademyId] = useState<string | null>(null);
    const [selectedPlanPreview, setSelectedPlanPreview] = useState<Plan | null>(null);
    
    // Camera state
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentStudentInfo, setPaymentStudentInfo] = useState<{ id: string, plan_id: string, plan_price: number } | null>(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'dinheiro' | 'pix' | 'credito' | 'debito'>('pix');
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

    // Load students, professors, and plans
    const loadData = async () => {
        const acaId = getCurrentAcademyId();
        if (!acaId) {
            setIsLoading(false);
            return;
        }
        setAcademyId(acaId);

        setIsLoading(true);

        const [studentsResult, professorsResult, plansResult] = await Promise.all([
            getAcademyMembers(acaId, 'ALUNO'),
            getAcademyProfessors(acaId),
            getAcademyPlans(acaId, true) // only active plans
        ]);

        if (professorsResult.success && professorsResult.data) {
            setProfessors(professorsResult.data);
        }

        if (plansResult.success && plansResult.data) {
            setPlans(plansResult.data);
        }

        if (studentsResult.success && studentsResult.data) {
            // Load plan info and payment status for each student
            const studentsWithPlans: StudentWithPlan[] = [];
            for (const student of studentsResult.data) {
                const planResult = await getStudentActivePlan(student.id);
                let paymentStatus: 'pago' | 'nao_pago' = 'nao_pago';
                if (planResult.data?.plan_id && acaId) {
                    paymentStatus = await getStudentPaymentStatus(student.id, planResult.data.plan_id, acaId);
                }
                studentsWithPlans.push({
                    ...student,
                    plan_name: planResult.data?.plan_name,
                    plan_id: planResult.data?.plan_id,
                    plan_start_date: planResult.data?.plan_start_date,
                    plan_end_date: planResult.data?.plan_end_date,
                    plan_has_time_restriction: planResult.data?.plan_has_time_restriction,
                    plan_allowed_start_time: planResult.data?.plan_allowed_start_time,
                    plan_allowed_end_time: planResult.data?.plan_allowed_end_time,
                    plan_price: planResult.data?.plan_price,
                    payment_status: paymentStatus
                });
            }
            setStudents(studentsWithPlans);
        }

        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    // Filter students
    const filteredStudents = students.filter(aluno => {
        const matchesSearch = aluno.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            aluno.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProfessor = filterProfessor === 'all' || aluno.professor_id === filterProfessor;
        return matchesSearch && matchesProfessor;
    });

    // Handle form input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Update plan preview when plan is selected
        if (name === 'plan_id') {
            const plan = plans.find(p => p.id === value);
            setSelectedPlanPreview(plan || null);
        }
    };

    // Handle create student
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!academyId) {
            setMessage({ type: 'error', text: 'Academia não identificada. Faça logout e login novamente.' });
            return;
        }

        if (!formData.plan_id) {
            setMessage({ type: 'error', text: 'Selecione um plano para o aluno.' });
            return;
        }

        setIsSubmitting(true);
        setMessage(null);

        try {
            let photoUrlToSave = '';
            
            // Fazer upload se houver imagem capturada
            if (capturedImage && !capturedImage.startsWith('http')) {
                const uploadedUrl = await uploadPhoto(capturedImage);
                if (uploadedUrl) {
                    photoUrlToSave = uploadedUrl;
                } else {
                    // Se falhou o upload e tinha imagem, perguntar ou avisar
                    setMessage({ type: 'error', text: 'Não foi possível salvar a foto. Verifique a conexão ou as permissões do Supabase.' });
                    setIsSubmitting(false);
                    return;
                }
            }

            const result = await createAcademyMember({
                name: formData.name,
                email: formData.email,
                phone: formData.phone || undefined,
                role: 'ALUNO',
                academy_id: academyId,
                professor_id: formData.professor_id || undefined,
                photo_url: photoUrlToSave || undefined
            });

            if (result.success && result.data) {
                // ... (existing plan logic)
                const planResult = await createStudentPlan(result.data.id, formData.plan_id, academyId);

                if (planResult.success) {
                    if (formData.payment_method !== 'pagar_depois' && selectedPlanPreview?.price) {
                        const payResult = await markStudentPlanAsPaid(
                            result.data.id,
                            formData.plan_id,
                            academyId,
                            selectedPlanPreview.price,
                            formData.payment_method
                        );
                        if (payResult.success) {
                            setMessage({ type: 'success', text: 'Aluno criado, plano vinculado e pagamento registrado com sucesso!' });
                        } else {
                            setMessage({ type: 'success', text: 'Aluno criado e plano vinculado, mas erro ao registrar pagamento.' });
                        }
                    } else {
                        setMessage({ type: 'success', text: 'Aluno criado com sucesso.' });
                    }
                }
                
                setFormData(initialFormData);
                setSelectedPlanPreview(null);
                setShowModal(false);
                loadData();
            } else {
                setMessage({ type: 'error', text: result.error || 'Erro ao criar aluno' });
            }
        } catch (error) {
            console.error('Error in handleSubmit:', error);
            setMessage({ type: 'error', text: 'Erro ao processar cadastro' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle renew student
    const handleRenew = async (e: FormEvent) => {
        e.preventDefault();
        if (!renewStudent || !academyId) return;
        if (!renewFormData.plan_id) {
            setMessage({ type: 'error', text: 'Selecione um plano para renovação.' });
            return;
        }

        setIsSubmitting(true);
        setMessage(null);

        if (renewFormData.professor_id !== renewStudent.professor_id) {
            await updateAcademyMember(
                renewStudent.id,
                { name: renewStudent.name, email: renewStudent.email }, // required interface fields
                renewFormData.professor_id || undefined
            );
        }

        const planResult = await createStudentPlan(renewStudent.id, renewFormData.plan_id, academyId);

        if (planResult.success) {
            if (renewFormData.payment_method !== 'pagar_depois' && selectedPlanPreview?.price) {
                const payResult = await markStudentPlanAsPaid(
                    renewStudent.id,
                    renewFormData.plan_id,
                    academyId,
                    selectedPlanPreview.price,
                    renewFormData.payment_method
                );
                if (payResult.success) {
                    setMessage({ type: 'success', text: 'Matrícula renovada e pagamento registrado!' });
                } else {
                    setMessage({ type: 'success', text: 'Matrícula renovada, mas erro no pagamento: ' + (payResult.error || '') });
                }
            } else {
                setMessage({ type: 'success', text: 'Matrícula renovada com sucesso (Pendente).' });
            }
            setShowRenewModal(false);
            setRenewStudent(null);
            setSelectedPlanPreview(null);
            loadData();
        } else {
            setMessage({ type: 'error', text: planResult.error || 'Erro ao renovar matrícula' });
        }

        setIsSubmitting(false);
    };

    useEffect(() => {
        if (isCameraOpen && cameraStream && videoRef.current) {
            videoRef.current.srcObject = cameraStream;
        }
    }, [isCameraOpen, cameraStream]);

    const startCamera = async () => {
        setCameraError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480 } 
            });
            setCameraStream(stream);
            setIsCameraOpen(true);
            setCapturedImage(null); // Reset capture when opening camera
        } catch (err: any) {
            console.error('Erro ao acessar câmera:', err);
            setCameraError('Permissão de câmera negada ou dispositivo não encontrado.');
            setIsCameraOpen(false);
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setIsCameraOpen(false);
    };

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            if (context) {
                // Redimensionamento automático para formato iDFace (proporção vertical ou quadrada)
                // Vamos usar 400x400 para garantir compatibilidade e boa qualidade
                canvas.width = 400;
                canvas.height = 400;

                // Calcular crop centralizado
                const size = Math.min(video.videoWidth, video.videoHeight);
                const x = (video.videoWidth - size) / 2;
                const y = (video.videoHeight - size) / 2;

                context.drawImage(video, x, y, size, size, 0, 0, 400, 400);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                setCapturedImage(dataUrl);
                stopCamera();
            }
        }
    };

    useEffect(() => {
        return () => {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [cameraStream]);

    const openRenewModal = (student: StudentWithPlan) => {
        setRenewStudent(student);
        setRenewFormData({
            name: student.name,
            email: student.email,
            phone: student.phone || '',
            professor_id: student.professor_id || '',
            plan_id: '',
            payment_method: 'pagar_depois',
            photo_url: student.photo_url || ''
        });
        setSelectedPlanPreview(null);
        setShowRenewModal(true);
    };

    const uploadPhoto = async (dataUrl: string): Promise<string | null> => {
        try {
            console.log('Iniciando processo de upload...');
            
            // Conversão manual de base64 para Blob (mais estável que fetch em alguns casos)
            const parts = dataUrl.split(',');
            const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            const bstr = atob(parts[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], { type: mime });
            
            console.log('Blob gerado com sucesso, iniciando upload para Supabase...');
            
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
            const filePath = `student-photos/${fileName}`;

            const { error } = await supabase.storage
                .from('avatars')
                .upload(filePath, blob, {
                    contentType: 'image/jpeg',
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                console.error('Erro retornado pelo Supabase Storage:', error);
                throw error;
            }

            console.log('Upload concluído, gerando URL pública...');
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            console.log('URL pública gerada:', publicUrl);
            return publicUrl;
        } catch (err: any) {
            console.error('Erro capturado no uploadPhoto:', err);
            
            // Tratamento de mensagens de erro comuns
            let errorMessage = err.message || 'Erro desconhecido';
            
            if (errorMessage === 'Failed to fetch') {
                errorMessage = 'Falha na conexão com o Supabase. Verifique sua internet ou se o serviço de Storage está ativo.';
            } else if (errorMessage.includes('row-level security')) {
                errorMessage = 'Permissão negada (RLS). Execute o SQL de permissões no Supabase.';
            }

            setCameraError(`Erro: ${errorMessage}`);
            return null;
        }
    };

    const handleRemovePhoto = () => {
        setCapturedImage(null);
        setFormData(prev => ({ ...prev, photo_url: '' }));
        setEditFormData(prev => ({ ...prev, photo_url: '' }));
    };

    const handleOpenNewModal = () => {
        setFormData(initialFormData);
        setCapturedImage(null);
        setShowModal(true);
    };

    const handleOpenEditModal = (student: StudentWithPlan) => {
        setSelectedStudent(student);
        setEditFormData({
            name: student.name,
            email: student.email,
            phone: student.phone || '',
            professor_id: student.professor_id || '',
            plan_id: student.plan_id || '',
            payment_method: 'pagar_depois',
            photo_url: student.photo_url || ''
        });
        setCapturedImage(student.photo_url || null);
        setShowEditModal(true);
    };

    // Handle edit student
    const handleEdit = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedStudent) return;

        setIsSubmitting(true);
        setMessage(null);

        try {
            let photoUrlToSave = editFormData.photo_url;

            // Fazer upload se houver nova imagem capturada
            if (capturedImage && !capturedImage.startsWith('http')) {
                const uploadedUrl = await uploadPhoto(capturedImage);
                if (uploadedUrl) {
                    photoUrlToSave = uploadedUrl;
                } else {
                    setMessage({ type: 'error', text: 'Erro ao fazer upload da nova foto. Tente novamente.' });
                    setIsSubmitting(false);
                    return;
                }
            } else if (!capturedImage) {
                photoUrlToSave = '';
            }

            const result = await updateAcademyMember(
                selectedStudent.id,
                {
                    name: editFormData.name,
                    email: editFormData.email.toLowerCase(),
                    phone: editFormData.phone || undefined,
                    photo_url: photoUrlToSave || undefined
                },
                editFormData.professor_id || undefined
            );

            if (result.success) {
                setMessage({ type: 'success', text: 'Aluno atualizado com sucesso!' });
                setShowEditModal(false);
                setSelectedStudent(null);
                loadData();
            } else {
                setMessage({ type: 'error', text: result.error || 'Erro ao atualizar aluno' });
            }
        } catch (error) {
            console.error('Error in handleEdit:', error);
            setMessage({ type: 'error', text: 'Erro ao atualizar aluno' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle toggle status
    const handleToggleStatus = async (student: AcademyMember) => {
        const result = await toggleMemberStatus(student.id, !student.is_active);
        if (result.success) {
            setMessage({ type: 'success', text: `Aluno ${student.is_active ? 'desativado' : 'ativado'} com sucesso!` });
            loadData();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao atualizar status' });
        }
    };

    // Handle delete
    const handleDelete = async () => {
        if (!selectedStudent) return;

        const result = await deleteAcademyMember(selectedStudent.id);
        if (result.success) {
            setMessage({ type: 'success', text: 'Aluno excluído com sucesso!' });
            setShowDeleteModal(false);
            setSelectedStudent(null);
            loadData();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao excluir aluno' });
        }
    };

    // Handle Payment Submission
    const handleProcessPayment = async () => {
        if (!academyId || !paymentStudentInfo) return;

        setIsProcessingPayment(true);
        const { id, plan_id, plan_price } = paymentStudentInfo;

        const res = await markStudentPlanAsPaid(
            id,
            plan_id,
            academyId,
            plan_price,
            selectedPaymentMethod
        );

        if (res.success) {
            setStudents(prev => prev.map(s => s.id === id ? { ...s, payment_status: 'pago' as const } : s));
            setMessage({ type: 'success', text: 'Pagamento registrado com sucesso!' });
            setShowPaymentModal(false);
            setPaymentStudentInfo(null);
        } else {
            setMessage({ type: 'error', text: res.error || 'Erro ao registrar pagamento' });
        }
        setIsProcessingPayment(false);
    };

    // Helper functions
    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    };

    const formatPrice = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    };

    const formatTime = (time: string) => {
        return time ? time.substring(0, 5) : '';
    };

    // Check if plan is expired
    const isPlanExpired = (endDate: string) => {
        if (!endDate) return false;
        return new Date(endDate) < new Date();
    };

    // Auto-hide message
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);



    // Plan preview info for the create modal
    const renderPlanPreview = () => {
        if (!selectedPlanPreview) return null;

        const now = new Date();
        const endDate = calculateEndDate(now, selectedPlanPreview.duration_in_months);

        return (
            <div style={{
                background: 'var(--background-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-3)',
                marginTop: 'var(--spacing-2)'
            }}>
                <div style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: 'var(--spacing-2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-1)'
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--primary-500)">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                    Resumo do Plano Selecionado
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-2)' }}>
                    <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>📅 Data de Início</div>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>{formatDateBR(now)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>📅 Data de Término</div>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>{formatDateBR(endDate)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>💰 Valor</div>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>{formatPrice(selectedPlanPreview.price)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>⏱ Duração</div>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                            {selectedPlanPreview.duration_in_months === -1 ? 'Diária' : selectedPlanPreview.duration_in_months === 0 ? 'Semanal' : `${selectedPlanPreview.duration_in_months} ${selectedPlanPreview.duration_in_months === 1 ? 'mês' : 'meses'}`}
                        </div>
                    </div>
                </div>
                {selectedPlanPreview.has_time_restriction && selectedPlanPreview.allowed_start_time && selectedPlanPreview.allowed_end_time && (
                    <div style={{
                        marginTop: 'var(--spacing-2)',
                        paddingTop: 'var(--spacing-2)',
                        borderTop: '1px solid var(--border-color)'
                    }}>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>🕒 Horário Permitido</div>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                            {formatTime(selectedPlanPreview.allowed_start_time)} - {formatTime(selectedPlanPreview.allowed_end_time)}
                        </div>
                    </div>
                )}
                {!selectedPlanPreview.has_time_restriction && (
                    <div style={{
                        marginTop: 'var(--spacing-2)',
                        paddingTop: 'var(--spacing-2)',
                        borderTop: '1px solid var(--border-color)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--success-500)'
                    }}>
                        ✅ Horário livre (sem restrição)
                    </div>
                )}
            </div>
        );
    };

    return (
        <DashboardLayout title="Alunos" menuItems={menuItems}>
            <div className="usuarios-page">
                {/* Message Toast */}
                {message && (
                    <div className={`message-toast ${message.type}`}>
                        {message.text}
                    </div>
                )}

                <div className="page-header">
                    <h2>Gerenciar Alunos</h2>
                    <button className="btn-add" onClick={handleOpenNewModal}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                        Novo Aluno
                    </button>
                </div>

                <div className="filters-bar">
                    <div className="search-input-wrapper">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                        </svg>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Buscar aluno..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="filter-select"
                        value={filterProfessor}
                        onChange={(e) => setFilterProfessor(e.target.value)}
                    >
                        <option value="all">Todos os professores</option>
                        {professors.map(prof => (
                            <option key={prof.id} value={prof.id}>{prof.name}</option>
                        ))}
                    </select>
                </div>

                {isLoading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Carregando alunos...</p>
                    </div>
                ) : !academyId ? (
                    <div className="empty-state">
                        <h3>Academia não identificada</h3>
                        <p>Faça login novamente para acessar os dados.</p>
                    </div>
                ) : filteredStudents.length === 0 ? (
                    <div className="empty-state">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                        </svg>
                        <h3>Nenhum aluno encontrado</h3>
                        <p>Clique em "Novo Aluno" para adicionar.</p>
                    </div>
                ) : (
                    <div className="users-grid">
                        {filteredStudents.map((aluno) => (
                            <div key={aluno.id} className="user-card">
                                <div className="user-card-avatar" style={{ overflow: 'hidden' }}>
                                    {aluno.photo_url ? (
                                        <img 
                                            src={aluno.photo_url} 
                                            alt={aluno.name} 
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                        />
                                    ) : (
                                        getInitials(aluno.name)
                                    )}
                                </div>
                                <div className="user-card-info">
                                    <div className="user-card-name">{aluno.name}</div>
                                    <div className="user-card-email">{aluno.email}</div>
                                    <div className="user-card-meta">
                                        <span className="role-badge aluno">Aluno</span>
                                        <span
                                            className={`status-badge ${aluno.is_active ? 'active' : 'inactive'}`}
                                            onClick={() => handleToggleStatus(aluno)}
                                            style={{ cursor: 'pointer' }}
                                            title="Clique para alterar status"
                                        >
                                            {aluno.is_active ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: 'var(--spacing-1)' }}>
                                        Prof: {aluno.professor_name || 'Não atribuído'}
                                    </div>
                                    {/* Plan information */}
                                    {aluno.plan_name ? (
                                        <div style={{
                                            fontSize: 'var(--font-size-xs)',
                                            marginTop: 'var(--spacing-1)',
                                            padding: 'var(--spacing-1) var(--spacing-2)',
                                            background: isPlanExpired(aluno.plan_end_date || '')
                                                ? 'rgba(239, 68, 68, 0.1)'
                                                : 'rgba(16, 185, 129, 0.1)',
                                            borderRadius: 'var(--radius-sm)',
                                            color: isPlanExpired(aluno.plan_end_date || '')
                                                ? 'var(--danger-500, #ef4444)'
                                                : 'var(--success-600, #059669)'
                                        }}>
                                            <div style={{ fontWeight: 600 }}>
                                                {isPlanExpired(aluno.plan_end_date || '') ? '⚠️ ' : '📋 '}
                                                {aluno.plan_name}
                                                {isPlanExpired(aluno.plan_end_date || '') && ' (Expirado)'}
                                            </div>
                                            <div style={{ opacity: 0.8 }}>
                                                {formatDate(aluno.plan_start_date || '')} → {formatDate(aluno.plan_end_date || '')}
                                            </div>
                                            {aluno.plan_has_time_restriction && aluno.plan_allowed_start_time && aluno.plan_allowed_end_time && (
                                                <div style={{ opacity: 0.8 }}>
                                                    🕒 {formatTime(aluno.plan_allowed_start_time)} - {formatTime(aluno.plan_allowed_end_time)}
                                                </div>
                                            )}
                                            {/* Payment status toggle */}
                                            <div style={{ marginTop: 'var(--spacing-1)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                                                {aluno.payment_status === 'pago' ? (
                                                    <>
                                                        <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 600, background: 'var(--success-100)', color: 'var(--success-700)' }}>✅ Pago</span>
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (!academyId || !aluno.plan_id) return;
                                                                const res = await markStudentPlanAsUnpaid(aluno.id, aluno.plan_id, academyId);
                                                                if (res.success) {
                                                                    setStudents(prev => prev.map(s => s.id === aluno.id ? { ...s, payment_status: 'nao_pago' as const } : s));
                                                                } else {
                                                                    setMessage({ type: 'error', text: res.error || 'Erro ao estornar' });
                                                                }
                                                            }}
                                                            style={{ padding: '1px 6px', fontSize: 'var(--font-size-xs)', border: '1px solid var(--error-300)', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--error-500)', cursor: 'pointer' }}
                                                            title="Estornar pagamento do mês corrente"
                                                        >
                                                            Estornar
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setPaymentStudentInfo({
                                                                id: aluno.id,
                                                                plan_id: aluno.plan_id!,
                                                                plan_price: aluno.plan_price!
                                                            });
                                                            setShowPaymentModal(true);
                                                        }}
                                                        style={{ padding: '2px 10px', fontSize: 'var(--font-size-xs)', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--success-500)', color: '#fff', cursor: 'pointer' }}
                                                    >
                                                        💳 Marcar como Pago
                                                    </button>
                                                )}
                                            </div>
                                            {isPlanExpired(aluno.plan_end_date || '') && (
                                                <div style={{ marginTop: 'var(--spacing-2)' }}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openRenewModal(aluno);
                                                        }}
                                                        style={{ padding: '6px 12px', fontSize: 'var(--font-size-xs)', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--primary-500)', color: '#fff', cursor: 'pointer', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                                                        </svg>
                                                        Renovar Matrícula
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{
                                            fontSize: 'var(--font-size-xs)',
                                            color: 'var(--warning-500, #f59e0b)',
                                            marginTop: 'var(--spacing-1)'
                                        }}>
                                            ⚠️ Sem plano vinculado
                                        </div>
                                    )}
                                </div>
                                <div className="user-card-actions">
                                    <button
                                        className="action-btn edit"
                                        title="Editar"
                                        onClick={() => handleOpenEditModal(aluno)}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                        </svg>
                                    </button>
                                    <button
                                        className="action-btn delete"
                                        title="Excluir"
                                        onClick={() => {
                                            setSelectedStudent(aluno);
                                            setShowDeleteModal(true);
                                        }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal Novo Aluno */}
                {showModal && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">Novo Aluno</h3>
                                <button className="modal-close" onClick={() => setShowModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                    </svg>
                                </button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body">
                                    {/* Camera Section */}
                                    <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
                                        <label className="form-label">Foto do Aluno</label>
                                        <div className="camera-container" style={{ 
                                            width: '100%', 
                                            aspectRatio: '1', 
                                            maxHeight: '280px',
                                            background: 'var(--gray-900)', 
                                            borderRadius: 'var(--radius-lg)', 
                                            overflow: 'hidden',
                                            position: 'relative',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {isCameraOpen ? (
                                                <>
                                                    <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    <button type="button" onClick={takePhoto} style={{ position: 'absolute', bottom: '15px', padding: '10px 20px', borderRadius: 'var(--radius-full)', background: 'var(--primary-500)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                                                        📸 Capturar agora
                                                    </button>
                                                </>
                                            ) : capturedImage ? (
                                                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                                    <img src={capturedImage} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    <div style={{ position: 'absolute', bottom: '15px', left: '0', right: '0', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                                                        <button type="button" onClick={startCamera} style={{ padding: '8px 15px', borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.9)', color: 'var(--gray-800)', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                                                            🔄 Refazer
                                                        </button>
                                                        <button type="button" onClick={handleRemovePhoto} style={{ padding: '8px 15px', borderRadius: 'var(--radius-full)', background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                                                            🗑️ Remover
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button type="button" onClick={startCamera} className="btn-camera-start" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
                                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                                    </svg>
                                                    <span>Clique para tirar foto</span>
                                                </button>
                                            )}
                                        </div>
                                        {cameraError && <p style={{ color: 'var(--error-500)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-2)' }}>⚠️ {cameraError}</p>}
                                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Nome Completo *</label>
                                        <input
                                            type="text"
                                            name="name"
                                            className="form-input"
                                            placeholder="Nome completo"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email *</label>
                                        <input
                                            type="email"
                                            name="email"
                                            className="form-input"
                                            placeholder="email@exemplo.com"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Telefone</label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            className="form-input"
                                            placeholder="(00) 00000-0000"
                                            value={formData.phone}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Professor Responsável</label>
                                        <select
                                            name="professor_id"
                                            className="form-input"
                                            value={formData.professor_id}
                                            onChange={handleInputChange}
                                        >
                                            <option value="">Selecione um professor</option>
                                            {professors.map(prof => (
                                                <option key={prof.id} value={prof.id}>{prof.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Plan Selection */}
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--primary-500)">
                                                <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z" />
                                            </svg>
                                            Plano *
                                        </label>
                                        <select
                                            name="plan_id"
                                            className="form-input"
                                            value={formData.plan_id}
                                            onChange={handleInputChange}
                                            required
                                            style={{
                                                borderColor: !formData.plan_id ? undefined : 'var(--primary-500)'
                                            }}
                                        >
                                            <option value="">Selecione um plano</option>
                                            {plans.map(plan => (
                                                <option key={plan.id} value={plan.id}>
                                                    {plan.name} — {formatPrice(plan.price)} — {plan.duration_in_months === -1 ? 'Diária' : plan.duration_in_months === 0 ? 'Semanal' : `${plan.duration_in_months} ${plan.duration_in_months === 1 ? 'mês' : 'meses'}`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Plan Preview */}
                                    {renderPlanPreview()}

                                    {/* Initial Payment Selection */}
                                    {formData.plan_id && selectedPlanPreview && (
                                        <div className="form-group" style={{ marginTop: 'var(--spacing-4)', paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--border-color)' }}>
                                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--success-500)">
                                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z" />
                                                </svg>
                                                Pagamento da Primeira Mensalidade (Opcional)
                                            </label>
                                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-2)' }}>
                                                Selecione como o aluno pagou a primeira mensalidade para registrar agora.
                                            </p>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--spacing-2)' }}>
                                                {[
                                                    { id: 'pagar_depois', label: 'Pagar Depois', icon: '⏳', default: true },
                                                    { id: 'pix', label: 'PIX', icon: '📱' },
                                                    { id: 'credito', label: 'Crédito', icon: '💳' },
                                                    { id: 'debito', label: 'Débito', icon: '💳' },
                                                    { id: 'dinheiro', label: 'Dinheiro', icon: '💵' }
                                                ].map(method => (
                                                    <div
                                                        key={method.id}
                                                        onClick={() => setFormData(prev => ({ ...prev, payment_method: method.id as any }))}
                                                        style={{
                                                            padding: 'var(--spacing-2)',
                                                            border: `1px solid ${formData.payment_method === method.id ? (method.id === 'pagar_depois' ? 'var(--gray-500)' : 'var(--success-500)') : 'var(--border-color)'}`,
                                                            borderRadius: 'var(--radius-md)',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: 'var(--spacing-1)',
                                                            background: formData.payment_method === method.id
                                                                ? (method.id === 'pagar_depois' ? 'var(--gray-100)' : 'var(--success-50)')
                                                                : 'var(--background-primary)',
                                                            transition: 'all 0.2s ease',
                                                            textAlign: 'center'
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '1.2rem' }}>{method.icon}</span>
                                                        <span style={{
                                                            fontSize: 'var(--font-size-xs)',
                                                            fontWeight: formData.payment_method === method.id ? 600 : 400,
                                                            color: formData.payment_method === method.id
                                                                ? (method.id === 'pagar_depois' ? 'var(--gray-700)' : 'var(--success-700)')
                                                                : 'var(--text-primary)'
                                                        }}>
                                                            {method.label}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        className="btn-cancel"
                                        onClick={() => { setShowModal(false); setSelectedPlanPreview(null); }}
                                        disabled={isSubmitting}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-submit"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? 'Criando...' : 'Criar Aluno'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal Editar Aluno */}
                {showEditModal && selectedStudent && (
                    <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">Editar Aluno</h3>
                                <button className="modal-close" onClick={() => setShowEditModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                    </svg>
                                </button>
                            </div>
                            <form onSubmit={handleEdit}>
                                <div className="modal-body">
                                    {/* Camera Section */}
                                    <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
                                        <label className="form-label">Foto do Aluno</label>
                                        <div className="camera-container" style={{ 
                                            width: '100%', 
                                            aspectRatio: '1', 
                                            maxHeight: '280px',
                                            background: 'var(--gray-900)', 
                                            borderRadius: 'var(--radius-lg)', 
                                            overflow: 'hidden',
                                            position: 'relative',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {isCameraOpen ? (
                                                <>
                                                    <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    <button type="button" onClick={takePhoto} style={{ position: 'absolute', bottom: '15px', padding: '10px 20px', borderRadius: 'var(--radius-full)', background: 'var(--primary-500)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                                                        📸 Capturar agora
                                                    </button>
                                                </>
                                            ) : capturedImage ? (
                                                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                                    <img src={capturedImage} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    <div style={{ position: 'absolute', bottom: '15px', left: '0', right: '0', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                                                        <button type="button" onClick={startCamera} style={{ padding: '8px 15px', borderRadius: 'var(--radius-full)', background: 'rgba(255,255,255,0.9)', color: 'var(--gray-800)', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                                                            🔄 Refazer
                                                        </button>
                                                        <button type="button" onClick={handleRemovePhoto} style={{ padding: '8px 15px', borderRadius: 'var(--radius-full)', background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                                                            🗑️ Remover
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button type="button" onClick={startCamera} className="btn-camera-start" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
                                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                                    </svg>
                                                    <span>Clique para tirar foto</span>
                                                </button>
                                            )}
                                        </div>
                                        {cameraError && <p style={{ color: 'var(--error-500)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-2)' }}>⚠️ {cameraError}</p>}
                                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Nome Completo *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Nome completo"
                                            value={editFormData.name}
                                            onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email *</label>
                                        <input
                                            type="email"
                                            className="form-input"
                                            placeholder="email@exemplo.com"
                                            value={editFormData.email}
                                            onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Telefone</label>
                                        <input
                                            type="tel"
                                            className="form-input"
                                            placeholder="(00) 00000-0000"
                                            value={editFormData.phone}
                                            onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Professor Responsável</label>
                                        <select
                                            className="form-input"
                                            value={editFormData.professor_id}
                                            onChange={(e) => setEditFormData(prev => ({ ...prev, professor_id: e.target.value }))}
                                        >
                                            <option value="">Selecione um professor</option>
                                            {professors.map(prof => (
                                                <option key={prof.id} value={prof.id}>{prof.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Current plan info (read-only in edit) */}
                                    {selectedStudent.plan_name && (
                                        <div style={{
                                            background: 'var(--background-secondary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: 'var(--spacing-3)',
                                            marginTop: 'var(--spacing-1)'
                                        }}>
                                            <div style={{
                                                fontSize: 'var(--font-size-sm)',
                                                fontWeight: 600,
                                                color: 'var(--text-primary)',
                                                marginBottom: 'var(--spacing-1)'
                                            }}>
                                                📋 Plano Atual: {selectedStudent.plan_name}
                                            </div>
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                                {formatDate(selectedStudent.plan_start_date || '')} → {formatDate(selectedStudent.plan_end_date || '')}
                                                {isPlanExpired(selectedStudent.plan_end_date || '') && (
                                                    <span style={{ color: 'var(--danger-500, #ef4444)', fontWeight: 600, marginLeft: 'var(--spacing-1)' }}>
                                                        (Expirado)
                                                    </span>
                                                )}
                                            </div>
                                            {selectedStudent.plan_has_time_restriction && selectedStudent.plan_allowed_start_time && selectedStudent.plan_allowed_end_time && (
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                                    🕒 {formatTime(selectedStudent.plan_allowed_start_time)} - {formatTime(selectedStudent.plan_allowed_end_time)}
                                                </div>
                                            )}
                                            <div style={{
                                                fontSize: 'var(--font-size-xs)',
                                                color: 'var(--text-tertiary)',
                                                marginTop: 'var(--spacing-1)',
                                                fontStyle: 'italic'
                                            }}>
                                                Para alterar o plano, acesse a gestão de planos.
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        className="btn-cancel"
                                        onClick={() => setShowEditModal(false)}
                                        disabled={isSubmitting}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-submit"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? 'Salvando...' : 'Salvar'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal Confirmar Exclusão */}
                {showDeleteModal && selectedStudent && (
                    <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                        <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">Confirmar Exclusão</h3>
                                <button className="modal-close" onClick={() => setShowDeleteModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                    </svg>
                                </button>
                            </div>
                            <div className="modal-body">
                                <p>Tem certeza que deseja excluir o aluno <strong>{selectedStudent.name}</strong>?</p>
                                <p className="warning-text">Esta ação não pode ser desfeita.</p>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={() => setShowDeleteModal(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    className="btn-delete"
                                    onClick={handleDelete}
                                >
                                    Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Renovar Matrícula */}
                {showRenewModal && renewStudent && (
                    <div className="modal-overlay" onClick={() => { setShowRenewModal(false); setSelectedPlanPreview(null); }}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">Renovar Matrícula</h3>
                                <button className="modal-close" onClick={() => { setShowRenewModal(false); setSelectedPlanPreview(null); }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                    </svg>
                                </button>
                            </div>
                            <form onSubmit={handleRenew}>
                                <div className="modal-body">
                                    <div style={{ padding: 'var(--spacing-3)', background: 'var(--background-secondary)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--spacing-3)' }}>
                                        <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>👤 {renewFormData.name}</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{renewFormData.email} • {renewFormData.phone || 'Sem telefone'}</div>
                                    </div>
                                    
                                    <div className="form-group">
                                        <label className="form-label">Professor Responsável (Opcional)</label>
                                        <select
                                            className="form-input"
                                            value={renewFormData.professor_id}
                                            onChange={(e) => setRenewFormData(prev => ({ ...prev, professor_id: e.target.value }))}
                                        >
                                            <option value="">Sem professor</option>
                                            {professors.map(prof => (
                                                <option key={prof.id} value={prof.id}>{prof.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Novo Plano *</label>
                                        <select
                                            className="form-input"
                                            value={renewFormData.plan_id}
                                            onChange={(e) => {
                                                setRenewFormData(prev => ({ ...prev, plan_id: e.target.value }));
                                                const plan = plans.find(p => p.id === e.target.value);
                                                setSelectedPlanPreview(plan || null);
                                            }}
                                            required
                                            style={{ borderColor: !renewFormData.plan_id ? undefined : 'var(--primary-500)' }}
                                        >
                                            <option value="">Selecione um plano</option>
                                            {plans.map(plan => (
                                                <option key={plan.id} value={plan.id}>
                                                    {plan.name} — {formatPrice(plan.price)} — {plan.duration_in_months} {plan.duration_in_months === 1 ? 'mês' : 'meses'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {renderPlanPreview()}

                                    {renewFormData.plan_id && selectedPlanPreview && (
                                        <div className="form-group" style={{ marginTop: 'var(--spacing-4)', paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--border-color)' }}>
                                            <label className="form-label">Pagamento da Renovação (Opcional)</label>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--spacing-2)' }}>
                                                {[
                                                    { id: 'pagar_depois', label: 'Pagar Depois', icon: '⏳' },
                                                    { id: 'pix', label: 'PIX', icon: '📱' },
                                                    { id: 'credito', label: 'Crédito', icon: '💳' },
                                                    { id: 'debito', label: 'Débito', icon: '💳' },
                                                    { id: 'dinheiro', label: 'Dinheiro', icon: '💵' }
                                                ].map(method => (
                                                    <div
                                                        key={method.id}
                                                        onClick={() => setRenewFormData(prev => ({ ...prev, payment_method: method.id as any }))}
                                                        style={{
                                                            padding: 'var(--spacing-2)',
                                                            border: `1px solid ${renewFormData.payment_method === method.id ? (method.id === 'pagar_depois' ? 'var(--gray-500)' : 'var(--success-500)') : 'var(--border-color)'}`,
                                                            borderRadius: 'var(--radius-md)',
                                                            cursor: 'pointer',
                                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-1)',
                                                            background: renewFormData.payment_method === method.id
                                                                ? (method.id === 'pagar_depois' ? 'var(--gray-100)' : 'var(--success-50)')
                                                                : 'var(--background-primary)',
                                                            textAlign: 'center'
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '1.2rem' }}>{method.icon}</span>
                                                        <span style={{
                                                            fontSize: 'var(--font-size-xs)',
                                                            fontWeight: renewFormData.payment_method === method.id ? 600 : 400,
                                                            color: renewFormData.payment_method === method.id
                                                                ? (method.id === 'pagar_depois' ? 'var(--gray-700)' : 'var(--success-700)')
                                                                : 'var(--text-primary)'
                                                        }}>
                                                            {method.label}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn-cancel" onClick={() => { setShowRenewModal(false); setSelectedPlanPreview(null); }} disabled={isSubmitting}>Cancelar</button>
                                    <button type="submit" className="btn-submit" disabled={isSubmitting}>{isSubmitting ? 'Renovando...' : 'Confirmar Renovação'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal de Confirmação de Pagamento */}
                {showPaymentModal && paymentStudentInfo && (
                    <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">Registrar Pagamento</h3>
                                <button className="modal-close" onClick={() => setShowPaymentModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                    </svg>
                                </button>
                            </div>
                            <div className="modal-body">
                                <p style={{ marginBottom: 'var(--spacing-4)', color: 'var(--text-secondary)' }}>
                                    Valor a receber: <strong>{formatPrice(paymentStudentInfo.plan_price)}</strong>
                                </p>

                                <div className="form-group">
                                    <label className="form-label" style={{ marginBottom: 'var(--spacing-2)' }}>Forma de Pagamento</label>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-2)' }}>
                                        {[
                                            { id: 'pix', label: 'PIX', icon: '📱' },
                                            { id: 'credito', label: 'Cartão de Crédito', icon: '💳' },
                                            { id: 'debito', label: 'Cartão de Débito', icon: '💳' },
                                            { id: 'dinheiro', label: 'Dinheiro', icon: '💵' }
                                        ].map(method => (
                                            <div
                                                key={method.id}
                                                onClick={() => setSelectedPaymentMethod(method.id as any)}
                                                style={{
                                                    padding: 'var(--spacing-3)',
                                                    border: `2px solid ${selectedPaymentMethod === method.id ? 'var(--primary-500)' : 'var(--border-color)'}`,
                                                    borderRadius: 'var(--radius-md)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 'var(--spacing-2)',
                                                    background: selectedPaymentMethod === method.id ? 'var(--primary-50)' : 'var(--background-primary)',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <span style={{ fontSize: '1.2rem' }}>{method.icon}</span>
                                                <span style={{
                                                    fontWeight: selectedPaymentMethod === method.id ? 600 : 400,
                                                    color: selectedPaymentMethod === method.id ? 'var(--primary-700)' : 'var(--text-primary)'
                                                }}>
                                                    {method.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer" style={{ marginTop: 'var(--spacing-6)' }}>
                                <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={() => setShowPaymentModal(false)}
                                    disabled={isProcessingPayment}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    className="btn-submit"
                                    onClick={handleProcessPayment}
                                    disabled={isProcessingPayment}
                                    style={{ background: 'var(--success-500)', borderColor: 'var(--success-500)' }}
                                >
                                    {isProcessingPayment ? 'Processando...' : 'Confirmar Pagamento'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
