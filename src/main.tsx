import '../style.css';
import { createRoot } from 'react-dom/client';
import { ActiveRoute } from 'active-route';
import {restoreRedirectedExternalSorterRoute} from './externalSorter/routing';

restoreRedirectedExternalSorterRoute();

const root = createRoot(document.querySelector<HTMLElement>('#root')!);

root.render(<ActiveRoute/>);
