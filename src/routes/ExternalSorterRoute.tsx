import {useEffect, useState} from 'react';
import {App} from '../app/App';
import {loadExternalSorter, type LoadedExternalSorter} from '../externalSorter/externalSorter';
import type {ExternalSorterRequest} from '../externalSorter/routing';

type LoadState =
    | {status: 'loading'}
    | {status: 'ready'; sorter: LoadedExternalSorter}
    | {status: 'error'; message: string};

export function ExternalSorterRoute({request}: {request: ExternalSorterRequest}) {
    const [state, setState] = useState<LoadState>({status: 'loading'});

    useEffect(() => {
        let cancelled = false;
        document.title = 'Loading sorter…';

        void loadExternalSorter(request)
            .then((sorter) => {
                if (!cancelled) {
                    setState({status: 'ready', sorter});
                }
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    setState({status: 'error', message: error instanceof Error ? error.message : String(error)});
                }
            });

        return () => {
            cancelled = true;
        };
    }, [request.sorterSlug, request.sourceRouteSlug]);

    if (state.status === 'ready') {
        const overviewHref = collectionIndexHref();
        return (
            <App
                config={state.sorter.config}
                songs={state.sorter.songs}
                overviewHref={overviewHref}
                importHref={new URL('import', overviewHref).toString()}
            />
        );
    }

    return (
        <div className="main-page main-page--landing">
            <div className="title">{state.status === 'loading' ? 'Loading external sorter…' : 'Could not load sorter'}</div>
            {state.status === 'error' ? <p className="sorter-index-empty">{state.message}</p> : null}
            <a className="basic-button" href={collectionIndexHref()}>Back to sorter index</a>
        </div>
    );
}

function collectionIndexHref(): string {
    const url = new URL(window.location.href);
    const externalRouteIndex = url.pathname.indexOf('/external/');
    url.pathname = externalRouteIndex >= 0 ? url.pathname.slice(0, externalRouteIndex + 1) : new URL('.', url).pathname;
    url.search = '';
    url.hash = '';
    return url.toString();
}
