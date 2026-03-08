// Catálogo de exercícios por grupo muscular
// Usado para sugestões no formulário de criação de treino

export interface MuscleGroup {
    label: string;
    icon: string;
    exercises: string[];
}

export const exerciseCatalog: MuscleGroup[] = [
    {
        label: 'Peito',
        icon: '🏋️',
        exercises: [
            'Supino Reto com Barra',
            'Supino Reto com Halteres',
            'Supino Reto na Máquina',
            'Supino Inclinado com Barra',
            'Supino Inclinado com Halteres',
            'Supino Inclinado na Máquina',
            'Supino Declinado com Barra',
            'Supino Declinado com Halteres',
            'Crucifixo Reto com Halteres',
            'Crucifixo Inclinado com Halteres',
            'Crossover Polia Alta',
            'Crossover Polia Média',
            'Crossover Polia Baixa',
            'Voador Peck Deck',
            'Flexão de Braços',
        ],
    },
    {
        label: 'Costas',
        icon: '🦅',
        exercises: [
            'Puxada Alta pela Frente',
            'Puxada Alta por Atrás',
            'Puxada Alta com Triângulo',
            'Remada Curvada com Barra',
            'Remada Curvada com Halteres',
            'Remada Baixa na Polia com Triângulo',
            'Remada Baixa na Polia com Barra Reta',
            'Remada Unilateral com Halter Serrote',
            'Remada Cavalinho',
            'Barra Fixa',
            'Pulldown na Polia com Barra Reta',
            'Pulldown na Polia com Corda',
            'Levantamento Terra',
        ],
    },
    {
        label: 'Quadríceps',
        icon: '🦵',
        exercises: [
            'Agachamento Livre com Barra',
            'Agachamento Frontal com Barra',
            'Agachamento no Smith',
            'Agachamento Hack',
            'Leg Press 45º',
            'Leg Press 90º',
            'Cadeira Extensora',
            'Afundo com Barra',
            'Afundo com Halteres',
            'Passada com Barra',
            'Passada com Halteres',
        ],
    },
    {
        label: 'Posteriores',
        icon: '🦵',
        exercises: [
            'Mesa Flexora',
            'Cadeira Flexora',
            'Stiff com Barra',
            'Stiff com Halteres',
            'Levantamento Terra Sumô',
        ],
    },
    {
        label: 'Glúteos',
        icon: '🍑',
        exercises: [
            'Elevação Pélvica com Barra',
            'Elevação Pélvica na Máquina',
            'Glúteo na Polia',
            'Glúteo 4 Apoios com Caneleira',
            'Glúteo 4 Apoios na Máquina',
        ],
    },
    {
        label: 'Adutores',
        icon: '🦵',
        exercises: ['Cadeira Adutora'],
    },
    {
        label: 'Abdutores',
        icon: '🦵',
        exercises: ['Cadeira Abdutora'],
    },
    {
        label: 'Ombros',
        icon: '⛰️',
        exercises: [
            'Desenvolvimento com Barra',
            'Desenvolvimento com Halteres',
            'Desenvolvimento na Máquina',
            'Elevação Lateral com Halteres',
            'Elevação Lateral na Polia',
            'Elevação Frontal com Barra',
            'Elevação Frontal com Halteres',
            'Elevação Frontal na Polia',
            'Crucifixo Inverso com Halteres',
            'Crucifixo Inverso na Máquina',
            'Crucifixo Inverso na Polia',
        ],
    },
    {
        label: 'Trapézio',
        icon: '⛰️',
        exercises: [
            'Encolhimento de Ombros com Barra',
            'Encolhimento de Ombros com Halteres',
            'Remada Alta com Barra',
            'Remada Alta na Polia',
        ],
    },
    {
        label: 'Bíceps',
        icon: '💪',
        exercises: [
            'Rosca Direta com Barra Reta',
            'Rosca Direta com Barra W',
            'Rosca Direta na Polia',
            'Rosca Alternada com Halteres',
            'Rosca Martelo com Halteres',
            'Rosca Martelo na Polia com Corda',
            'Rosca Scott com Barra',
            'Rosca Scott na Máquina',
            'Rosca Concentrada com Halter',
        ],
    },
    {
        label: 'Antebraço',
        icon: '💪',
        exercises: [
            'Rosca Inversa com Barra',
            'Rosca Inversa na Polia',
            'Flexão de Punho com Barra',
            'Flexão de Punho com Halteres',
        ],
    },
    {
        label: 'Tríceps',
        icon: '🐎',
        exercises: [
            'Tríceps Pulley com Barra Reta',
            'Tríceps Pulley com Barra V',
            'Tríceps Corda',
            'Tríceps Testa com Barra W',
            'Tríceps Testa com Halteres',
            'Tríceps Francês com Halter',
            'Tríceps Francês com Barra',
            'Tríceps Francês na Polia',
            'Tríceps Coice com Halter',
            'Tríceps Coice na Polia',
            'Mergulho nas Paralelas',
            'Mergulho no Banco',
        ],
    },
    {
        label: 'Abdômen',
        icon: '🍫',
        exercises: [
            'Abdominal Supra no Solo',
            'Abdominal Infra no Solo',
            'Abdominal Infra Pendurado na Barra',
            'Abdominal Oblíquo no Solo',
            'Abdominal na Máquina',
            'Abdominal Crunch na Polia com Corda',
        ],
    },
    {
        label: 'Core',
        icon: '🛡️',
        exercises: [
            'Prancha Isométrica',
            'Roda Abdominal',
        ],
    },
    {
        label: 'Panturrilhas',
        icon: '🐄',
        exercises: [
            'Panturrilha em Pé na Máquina',
            'Panturrilha em Pé no Smith',
            'Panturrilha em Pé Livre no Degrau',
            'Panturrilha Sentado na Máquina',
            'Panturrilha no Leg Press',
        ],
    },
];

// Grupos compostos (combinações)
const upperBodyGroups = ['Peito', 'Costas', 'Ombros', 'Trapézio', 'Bíceps', 'Tríceps', 'Antebraço', 'Abdômen', 'Core'];
const lowerBodyGroups = ['Quadríceps', 'Posteriores', 'Glúteos', 'Adutores', 'Abdutores', 'Panturrilhas'];

export const compositeGroups: MuscleGroup[] = [
    {
        label: 'Superior',
        icon: '🔝',
        exercises: exerciseCatalog
            .filter(g => upperBodyGroups.includes(g.label))
            .flatMap(g => g.exercises),
    },
    {
        label: 'Inferior',
        icon: '🦵',
        exercises: exerciseCatalog
            .filter(g => lowerBodyGroups.includes(g.label))
            .flatMap(g => g.exercises),
    },
    {
        label: 'Full Body',
        icon: '⚡',
        exercises: exerciseCatalog.flatMap(g => g.exercises),
    },
];

// Todos os grupos disponíveis para seleção
export const allMuscleGroups: MuscleGroup[] = [...exerciseCatalog, ...compositeGroups];

// Buscar exercícios por nome de grupo
export function getExercisesForGroup(groupLabel: string): string[] {
    const group = allMuscleGroups.find(
        g => g.label.toLowerCase() === groupLabel.toLowerCase()
    );
    return group?.exercises || [];
}

// Buscar exercícios com base no nome do dia (pode conter múltiplos grupos separados por " e ", " / ", ", ")
export function getExercisesForDayName(dayName: string): string[] {
    if (!dayName.trim()) return [];

    // Tentar match exato primeiro
    const exactMatch = allMuscleGroups.find(
        g => g.label.toLowerCase() === dayName.trim().toLowerCase()
    );
    if (exactMatch) return exactMatch.exercises;

    // Separar por delimitadores comuns: " e ", " / ", ", ", " + "
    const parts = dayName.split(/\s+e\s+|\s*\/\s*|\s*,\s*|\s*\+\s*/i).map(p => p.trim()).filter(Boolean);

    const exercises = new Set<string>();
    for (const part of parts) {
        const group = allMuscleGroups.find(
            g => g.label.toLowerCase() === part.toLowerCase()
        );
        if (group) {
            group.exercises.forEach(ex => exercises.add(ex));
        }
    }

    return Array.from(exercises);
}
