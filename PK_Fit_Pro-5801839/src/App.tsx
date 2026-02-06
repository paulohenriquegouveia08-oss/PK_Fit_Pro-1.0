import { BrowserRouter } from 'react-router-dom';
import { Providers } from './app/providers';
import { AppRoutes } from './app/routes';
import './styles/reset.css';
import './styles/variables.css';
import './styles/theme.css';

function App() {
    return (
        <BrowserRouter>
            <Providers>
                <AppRoutes />
            </Providers>
        </BrowserRouter>
    );
}

export default App;
