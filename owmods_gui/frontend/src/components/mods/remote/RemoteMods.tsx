import { useTauri, useTranslation } from "@hooks";
import { memo, useRef, useState } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";
import RemoteModRow from "./RemoteModRow";

const RemoteMods = memo(() => {
    const [filter, setFilter] = useState("");
    const [tempFilter, setTempFilter] = useState("");
    const [status, mods, err] = useTauri<string[]>("REMOTE-REFRESH", "get_remote_mods", { filter });

    const activeTimeout = useRef<number | null>(null);

    const searchLabel = useTranslation("SEARCH");

    const onChangeFilter = (newFilter: string) => {
        setTempFilter(newFilter);
        if (activeTimeout.current) {
            clearTimeout(activeTimeout.current);
        }
        activeTimeout.current = setTimeout(() => setFilter(newFilter), 450);
    };

    let res = <></>;

    if ((status === "Loading" && mods === null) || tempFilter !== filter) {
        res = <div className="mod-list center-loading" aria-busy></div>;
    } else if (status === "Error") {
        res = <p className="mod-list center-loading">{err!.toString()}</p>;
    } else {
        const remoteMods = mods!;
        res = (
            <div className="mod-list remote">
                <AutoSizer>
                    {({ width, height }) => (
                        <FixedSizeList
                            itemCount={remoteMods.length}
                            itemSize={120}
                            itemKey={(index) => remoteMods[index]}
                            width={width}
                            height={height}
                        >
                            {({ index, style }) => (
                                <RemoteModRow style={style} uniqueName={remoteMods[index]} />
                            )}
                        </FixedSizeList>
                    )}
                </AutoSizer>
            </div>
        );
    }
    return (
        <>
            <input
                placeholder={searchLabel}
                className="mod-search"
                id="searchRemote"
                value={tempFilter}
                onChange={(e) => onChangeFilter(e.target.value)}
            />
            {res}
        </>
    );
});

export default RemoteMods;
