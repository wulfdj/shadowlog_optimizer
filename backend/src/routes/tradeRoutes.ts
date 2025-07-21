import { Router } from "express";
import { AppDataSource } from "../database/data-source";
import { Trade, transformNumeric } from "../entities/Trade";
import { time } from "console";

const router = Router();

/**
 * A helper function to map raw CSV row data to a proper Trade entity instance,
 * applying all necessary type conversions.
 */
function createTradeEntityFromRaw(raw: any, timeframe: string, instrument: string): Trade {
    const trade = new Trade();

    // Map and transform each property
    trade.timeframe = timeframe;
    trade.instrument = instrument;
    trade.Date = raw.Date;
    trade.Time = raw.Time;
    trade.EU_OFFS = parseInt(raw.EU_OFFS, 10) || 0;
    trade.Setup = raw.Setup;
    trade.Direction = raw.Direction;
    trade.Entered = String(raw.Entered).toUpperCase() === 'TRUE';
    trade.Canceled_After_Candles = parseInt(raw.Canceled_After_Candles, 10) || 0;
    trade.Entered_After_Seconds = parseInt(raw.Entered_After_Seconds, 10) || 0;

    // Use our numeric transformer for all float values
    trade.TP_1RR_PW_PIPS = transformNumeric(raw.TP_1RR_PW_PIPS);
    trade.TP_1RR_STR_PIPS = transformNumeric(raw.TP_1RR_STR_PIPS);
    trade.TP_SR_NEAREST_PIPS = transformNumeric(raw.TP_SR_NEAREST_PIPS);
    trade.TP_SR_STATIC_PIPS = transformNumeric(raw.TP_SR_STATIC_PIPS);
    trade.TP_SR_CURRENT_PIPS = transformNumeric(raw.TP_SR_CURRENT_PIPS);
    trade.TP_SR_LTA_PIPS = transformNumeric(raw.TP_SR_LTA_PIPS);
    trade.SL_PW_PIPS = transformNumeric(raw.SL_PW_PIPS);
    trade.SL_STR_PIPS = transformNumeric(raw.SL_STR_PIPS);
    trade.Candle_Size = transformNumeric(raw.Candle_Size);
    trade.Breakout_Distance = transformNumeric(raw.Breakout_Distance);
    trade.Entry_Distance = transformNumeric(raw.Entry_Distance);
    trade.S2_Previous_Support_Distance = transformNumeric(raw.S2_Previous_Support_Distance);
    trade.S2_Previous_Resistance_Distance = transformNumeric(raw.S2_Previous_Resistance_Distance);

    // Booleans
    trade.TP_1RR_PW_WIN = String(raw.TP_1RR_PW_WIN).toUpperCase() === 'TRUE';
    trade.TP_1RR_STR_WIN = String(raw.TP_1RR_STR_WIN).toUpperCase() === 'TRUE';
    trade.TP_SR_NEAREST_SL_PW_WIN = String(raw.TP_SR_NEAREST_SL_PW_WIN).toUpperCase() === 'TRUE';
    trade.TP_SR_NEAREST_SL_STR_WIN = String(raw.TP_SR_NEAREST_SL_STR_WIN).toUpperCase() === 'TRUE';
    trade.TP_SR_STATIC_SL_PW_WIN = String(raw.TP_SR_STATIC_SL_PW_WIN).toUpperCase() === 'TRUE';
    trade.TP_SR_STATIC_SL_STR_WIN = String(raw.TP_SR_STATIC_SL_STR_WIN).toUpperCase() === 'TRUE';
    trade.TP_SR_CURRENT_PW_WIN = String(raw.TP_SR_CURRENT_PW_WIN).toUpperCase() === 'TRUE';
    trade.TP_SR_CURRENT_STR_WIN = String(raw.TP_SR_CURRENT_STR_WIN).toUpperCase() === 'TRUE';
    trade.TP_SR_LTA_SL_PW_WIN = String(raw.TP_SR_LTA_SL_PW_WIN).toUpperCase() === 'TRUE';
    trade.TP_SR_LTA_SL_STR_WIN = String(raw.TP_SR_LTA_SL_STR_WIN).toUpperCase() === 'TRUE';
    trade.Entry_Candle_Has_Wick = String(raw.Entry_Candle_Has_Wick).toUpperCase() === 'TRUE';
    trade.Setup_Candle_Has_Wick = String(raw.Setup_Candle_Has_Wick).toUpperCase() === 'TRUE';
    trade.M5_Candle = String(raw.M5_Candle).toUpperCase() === 'TRUE';
    trade.M10_Candle = String(raw.M10_Candle).toUpperCase() === 'TRUE';
    trade.M10_Candle_Open = String(raw.M10_Candle_Open).toUpperCase() === 'TRUE';
    trade.M15_Candle = String(raw.M15_Candle).toUpperCase() === 'TRUE';
    trade.M15_Candle_Open = String(raw.M15_Candle_Open).toUpperCase() === 'TRUE';
    trade.M30_Candle = String(raw.M30_Candle).toUpperCase() === 'TRUE';
    trade.M30_Candle_Open = String(raw.M30_Candle_Open).toUpperCase() === 'TRUE';
    trade.H1_Candle = String(raw.H1_Candle).toUpperCase() === 'TRUE';
    trade.H1_Candle_Open = String(raw.H1_Candle_Open).toUpperCase() === 'TRUE';
    trade.H4_Candle = String(raw.H4_Candle).toUpperCase() === 'TRUE';
    trade.H4_Candle_Open = String(raw.H4_Candle_Open).toUpperCase() === 'TRUE';
    trade.D1_Candle = String(raw.D1_Candle).toUpperCase() === 'TRUE';
    trade.D1_Candle_Open = String(raw.D1_Candle_Open).toUpperCase() === 'TRUE';
    trade.M5_Consecutive_Candles = parseInt(raw.M5_Consecutive_Candles);
    trade.M10_Consecutive_Candles = parseInt(raw.M10_Consecutive_Candles);
    trade.M15_Consecutive_Candles = parseInt(raw.M15_Consecutive_Candles);
    trade.M30_Consecutive_Candles = parseInt(raw.M30_Consecutive_Candles);
    trade.H1_Consecutive_Candles = parseInt(raw.H1_Consecutive_Candles);
    
    trade.Gaussian_Trend_1 = String(raw.Gaussian_Trend_1).toUpperCase() === 'TRUE';
    trade.Gaussian_Trend_2 = String(raw.Gaussian_Trend_2).toUpperCase() === 'TRUE';
    trade.Gaussian_Trend_3 = String(raw.Gaussian_Trend_3).toUpperCase() === 'TRUE';
    trade.Gaussian_Trend_4 = String(raw.Gaussian_Trend_4).toUpperCase() === 'TRUE';
    trade.Gaussian_Trend_5 = String(raw.Gaussian_Trend_5).toUpperCase() === 'TRUE';
    trade.Gaussian_Trend_6 = String(raw.Gaussian_Trend_6).toUpperCase() === 'TRUE';
    trade.Gaussian_Trend_7 = String(raw.Gaussian_Trend_7).toUpperCase() === 'TRUE';
    trade.Closed_In_LTA = String(raw.Closed_In_LTA).toUpperCase() === 'TRUE';
    trade.LTA_Range_Breakout = String(raw.LTA_Range_Breakout).toUpperCase() === 'TRUE';
    trade.Current_Range_Breakout = String(raw.Current_Range_Breakout).toUpperCase() === 'TRUE';
    trade.Nearest_Range_Breakout = String(raw.Nearest_Range_Breakout).toUpperCase() === 'TRUE';
    trade.Static_Range_Breakout = String(raw.Static_Range_Breakout).toUpperCase() === 'TRUE';

    // Integers
    trade.Breakout_Candle_Count = parseInt(raw.Breakout_Candle_Count, 10) || 0;

    return trade;
}
/**
 * @route   GET /api/trades/timeframes
 * @desc    Get a list of unique, distinct timeframes stored in the database.
 */
router.get("/:instrument/timeframes", async (req, res) => {
    const {instrument} = req.params;
    try {
        const result = await AppDataSource.getRepository(Trade)
            .createQueryBuilder("trade")
            .select("DISTINCT trade.timeframe", "timeframe")
            .where("trade.instrument = :instrument", {instrument})
            .getRawMany();
        
        const timeframes = result.map(item => item.timeframe);
        res.json(timeframes);
    } catch (error) {
        console.error("Error fetching distinct timeframes:", error);
        res.status(500).json({ message: "Error fetching timeframes" });
    }
});


/**
 * @route   GET /api/trades/:timeframe
 * @desc    Get all trade records for a SPECIFIC timeframe.
 */
router.get("/:instrument/:timeframe", async (req, res) => {
    const { instrument, timeframe } = req.params;
    const tradeRepository = AppDataSource.getRepository(Trade);
    try {
        const trades = await tradeRepository.find({
            where: { timeframe: timeframe, instrument: instrument }, // Filter by the timeframe
            order: { Date: "ASC", Time: "ASC" }
        });
        res.json(trades);
    } catch (error) {
        console.error(`Error fetching trades for ${timeframe}:`, error);
        res.status(500).json({ message: `Error fetching trades for ${timeframe}` });
    }
});


/**
 * @route   POST /api/trades/upload/:timeframe
 * @desc    Upload trades for a SPECIFIC timeframe, handling large files with chunking.
 */
router.post("/upload/:instrument/:timeframe", async (req, res) => {
    const { instrument, timeframe } = req.params;
    const rawTrades = req.body;

    if (!timeframe) {
        return res.status(400).json({ message: "Timeframe parameter is required." });
    }
    if (!Array.isArray(rawTrades) || rawTrades.length === 0) {
        return res.status(400).json({ message: "No trade data provided." });
    }

    console.log(`Starting upload for timeframe: ${timeframe}`);

    // Transform raw data into entities, now including the timeframe
    const tradeEntities = rawTrades.map(raw => createTradeEntityFromRaw(raw, instrument, timeframe));

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        // IMPORTANT: Now we only clear the data for the specific timeframe being uploaded.
        console.log(`Clearing existing trade data for timeframe: ${timeframe}...`);
        await queryRunner.manager.delete(Trade, { timeframe: timeframe });

        const chunkSize = 500;
        console.log(`Starting bulk insert of ${tradeEntities.length} records...`);

        for (let i = 0; i < tradeEntities.length; i += chunkSize) {
            const chunk = tradeEntities.slice(i, i + chunkSize);
            await queryRunner.manager.save(chunk);
            console.log(`Saved chunk ${i / chunkSize + 1}...`);
        }

        await queryRunner.commitTransaction();
        console.log(`Bulk insert for ${timeframe} successful. Transaction committed.`);
        res.status(201).json({ message: `Successfully cleared and saved ${tradeEntities.length} trades for ${timeframe}.` });

    } catch (error) {
        console.error("Error during bulk insert, rolling back transaction.", error);
        await queryRunner.rollbackTransaction();
        res.status(500).json({ message: "Failed to save trade data. The operation was rolled back." });

    } finally {
        await queryRunner.release();
    }
});

export default router;