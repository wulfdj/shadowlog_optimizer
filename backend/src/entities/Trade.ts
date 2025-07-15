import { Entity, PrimaryGeneratedColumn, Column, Index } from "typeorm";

// This transformer correctly handles converting comma-decimal strings from the CSV
// into proper floating-point numbers for the database and your application logic.
export function transformNumeric(value: any): number {
    if (value === null || value === undefined || value === "") {
        return 0;
    }
    const sValue = String(value).replace(",", ".");
    const num = parseFloat(sValue);
    return isNaN(num) ? 0 : num;
}

@Entity()
export class Trade {
    @PrimaryGeneratedColumn()
    id!: number;

    @Index() // Add a database index for faster lookups
    @Column({ type: 'varchar', length: 10 })
    timeframe!: string; // e.g., '5M', '15M', '1H'

    // --- Core Info ---
    @Column()
    Date!: string;

    @Column()
    Time!: string;

    @Column({ type: 'integer' })
    EU_OFFS!: number;

    @Column()
    Setup!: string;

    @Column()
    Direction!: string;

    @Column()
    Entered!: boolean;

    @Column({ type: 'integer' })
    Canceled_After_Candles!: number;

    @Column({ type: 'integer' })
    Entered_After_Seconds!: number;

    // --- Target Profit (TP) Pips ---
      @Column({ type: 'float' })
    TP_1RR_PW_PIPS!: number;

      @Column({ type: 'float' })
    TP_1RR_STR_PIPS!: number;
    
   @Column({ type: 'float' })
    TP_SR_NEAREST_PIPS!: number;

     @Column({ type: 'float' })
    TP_SR_STATIC_PIPS!: number;

      @Column({ type: 'float' })
    TP_SR_CURRENT_PIPS!: number;

      @Column({ type: 'float' })
    TP_SR_LTA_PIPS!: number;

    // --- Target Profit (TP) Win Conditions ---
    @Column()
    TP_1RR_PW_WIN!: boolean;

    @Column()
    TP_1RR_STR_WIN!: boolean;

    @Column()
    TP_SR_NEAREST_SL_PW_WIN!: boolean;
    
    @Column()
    TP_SR_NEAREST_SL_STR_WIN!: boolean;

    @Column()
    TP_SR_STATIC_SL_PW_WIN!: boolean;
    
    @Column()
    TP_SR_STATIC_SL_STR_WIN!: boolean;

    @Column()
    TP_SR_CURRENT_PW_WIN!: boolean;
    
    @Column()
    TP_SR_CURRENT_STR_WIN!: boolean;

    @Column()
    TP_SR_LTA_SL_PW_WIN!: boolean;

    @Column()
    TP_SR_LTA_SL_STR_WIN!: boolean;

    // --- Stop Loss (SL) Pips ---
      @Column({ type: 'float' })
    SL_PW_PIPS!: number;

      @Column({ type: 'float' })
    SL_STR_PIPS!: number;

    // --- Candle Info ---
      @Column({ type: 'float' })
    Candle_Size!: number;

    @Column()
    Entry_Candle_Has_Wick!: boolean;

    @Column()
    Setup_Candle_Has_Wick!: boolean;
    
      @Column({ type: 'float' })
    Breakout_Distance!: number;
    
      @Column({ type: 'float' })
    Entry_Distance!: number;

    @Column({ type: 'integer' })
    Breakout_Candle_Count!: number;
    
    // --- Higher Timeframe (HTF) Candle States ---
    @Column()
    M5_Candle!: boolean;
    
    @Column({ type: 'integer' })
    M5_Consecutive_Candles!: number;
    
    @Column()
    M10_Candle!: boolean;
    
    @Column()
    M10_Candle_Open!: boolean;

    @Column({ type: 'integer' })
    M10_Consecutive_Candles!: number;
    
    @Column()
    M15_Candle!: boolean;

    @Column()
    M15_Candle_Open!: boolean;

    @Column({ type: 'integer' })
    M15_Consecutive_Candles!: number;

    @Column()
    M30_Candle!: boolean;

    @Column()
    M30_Candle_Open!: boolean;

    @Column({ type: 'integer' })
    M30_Consecutive_Candles!: number;

    @Column()
    H1_Candle!: boolean;

    @Column()
    H1_Candle_Open!: boolean;

    @Column({ type: 'integer' })
    H1_Consecutive_Candles!: number;

    @Column()
    H4_Candle!: boolean;

    @Column()
    H4_Candle_Open!: boolean;

    @Column()
    D1_Candle!: boolean;

    @Column()
    D1_Candle_Open!: boolean;
    
    // --- Gaussian Trends ---
    @Column()
    Gaussian_Trend_1!: boolean;

    @Column()
    Gaussian_Trend_2!: boolean;

    @Column()
    Gaussian_Trend_3!: boolean;
    
    @Column()
    Gaussian_Trend_4!: boolean;
    
    @Column()
    Gaussian_Trend_5!: boolean;
    
    @Column()
    Gaussian_Trend_6!: boolean;
    
    @Column()
    Gaussian_Trend_7!: boolean;
 
      @Column({ type: 'float' })
    S2_Previous_Support_Distance!: number;

      @Column({ type: 'float' })
    S2_Previous_Resistance_Distance!: number;

    // --- Range Breakout ---
    @Column()
    Closed_In_LTA!: boolean;

    @Column()
    LTA_Range_Breakout!: boolean;

    @Column()
    Current_Range_Breakout!: boolean;
    
    @Column()
    Nearest_Range_Breakout!: boolean;
    
    @Column()
    Static_Range_Breakout!: boolean;
}