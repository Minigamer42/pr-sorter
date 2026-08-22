import { SorterIndex } from '../sorterIndex/SorterIndex';
import {externalSorterRequestFromUrl} from '../externalSorter/routing';
import {ExternalSorterRoute} from './ExternalSorterRoute';

export function ActiveRoute() {
    const externalSorterRequest = externalSorterRequestFromUrl(window.location.href);
    if (externalSorterRequest) {
        return <ExternalSorterRoute request={externalSorterRequest}/>;
    }

    return <SorterIndex/>;
}
