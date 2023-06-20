import { hooks } from "@commands";
import ODTooltip from "@components/common/ODTooltip";
import { Box, Chip, Palette, Skeleton, TableCell, Typography, useTheme } from "@mui/material";
import { SocketMessageType } from "@types";
import { memo, useMemo } from "react";

export interface LogRowProps {
    port: number;
    index: number;
    count: number;
}

const getColor = (palette: Palette, messageType: SocketMessageType) => {
    switch (messageType) {
        case SocketMessageType.Info:
            return palette.info.light;
        case SocketMessageType.Success:
            return palette.success.light;
        case SocketMessageType.Warning:
            return palette.warning.light;
        case SocketMessageType.Error:
        case SocketMessageType.Fatal:
            return palette.error.light;
        case SocketMessageType.Debug:
            return palette.grey[800];
        default:
            return palette.text.primary;
    }
};

const LogRow = memo(function LogRow(props: LogRowProps) {
    const theme = useTheme();

    const [status, logLine, err] = hooks.getLogLine("LOG-UPDATE", {
        port: props.port,
        line: props.index
    });

    const messageType = useMemo(() => {
        return Object.values(SocketMessageType)[
            (logLine?.message.messageType as unknown as number) ?? 0
        ] as SocketMessageType;
    }, [logLine?.message.messageType]);

    const cellStyle = {
        backgroundColor: theme.palette.grey[900],
        paddingTop: theme.spacing(1),
        paddingBottom: theme.spacing(1)
    };

    const messageLines = useMemo(
        () => (logLine?.message.message ?? "").split("\n"),
        [logLine?.message.message]
    );

    return (
        <>
            <TableCell sx={cellStyle}>
                {status === "Loading" && logLine === null ? (
                    <Skeleton width={50} />
                ) : (
                    <ODTooltip
                        title={`${logLine?.message.senderName ?? "Unknown"}::${
                            logLine?.message.senderType ?? "Unknown"
                        }`}
                    >
                        <Typography>{logLine?.message.senderName ?? "Unknown"}</Typography>
                    </ODTooltip>
                )}
            </TableCell>
            <TableCell sx={cellStyle}>
                <Box display="flex">
                    <Box flexGrow={1} sx={{ wordBreak: "break-all" }}>
                        {status === "Loading" && logLine === null ? (
                            <>
                                <Skeleton width={150} />
                                <Skeleton width={102} />
                            </>
                        ) : status === "Error" ? (
                            <Typography flexGrow={1} color="error">
                                {err?.toString()}
                            </Typography>
                        ) : (
                            <Typography minWidth={0} color={getColor(theme.palette, messageType)}>
                                {messageLines.map((line, i) => (
                                    <div key={`${i}-${line}`}>{line}</div>
                                ))}
                            </Typography>
                        )}{" "}
                    </Box>
                    {props.count > 1 && (
                        <Box justifySelf="end">
                            <Chip size="small" label={`x${props.count}`} />
                        </Box>
                    )}
                </Box>
            </TableCell>
        </>
    );
});

export default LogRow;
