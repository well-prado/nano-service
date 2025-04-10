import { 
  type INanoServiceResponse, 
  NanoService, 
  NanoServiceResponse 
} from "@nanoservice-ts/runner";
import { type Context, GlobalError } from "@nanoservice-ts/shared";
import axios from "axios";

type InputType = {
  city: string;
};

export default class WeatherToolNode extends NanoService<InputType> {
  constructor() {
    super();
    
    this.inputSchema = {
      type: "object",
      properties: {
        city: { type: "string" }
      },
      required: ["city"]
    };
  }

  async handle(ctx: Context, inputs: InputType): Promise<INanoServiceResponse> {
    const response = new NanoServiceResponse();

    try {
      const city = inputs.city || "New York";
      
      // Call real weather API using Open-Meteo
      console.log(`Fetching real weather data for ${city}`);
      
      // First get geocoding data to convert city name to coordinates
      const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;
      const geocodingResponse = await axios.get(geocodingUrl);
      
      if (!geocodingResponse.data.results || geocodingResponse.data.results.length === 0) {
        throw new Error(`Could not find coordinates for city: ${city}`);
      }
      
      const { latitude, longitude, name } = geocodingResponse.data.results[0];
      console.log(`Found coordinates for ${name}: ${latitude}, ${longitude}`);
      
      // Now get the actual weather data
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;
      const weatherResponse = await axios.get(weatherUrl);
      
      const current = weatherResponse.data.current;
      
      // Map weather code to condition
      const weatherConditions: {[key: number]: string} = {
        0: 'Clear',
        1: 'Mainly Clear',
        2: 'Partly Cloudy',
        3: 'Cloudy',
        45: 'Foggy',
        48: 'Rime Fog',
        51: 'Light Drizzle',
        53: 'Moderate Drizzle',
        55: 'Dense Drizzle',
        56: 'Light Freezing Drizzle',
        57: 'Dense Freezing Drizzle',
        61: 'Slight Rain',
        63: 'Moderate Rain',
        65: 'Heavy Rain',
        66: 'Light Freezing Rain',
        67: 'Heavy Freezing Rain',
        71: 'Slight Snow',
        73: 'Moderate Snow',
        75: 'Heavy Snow',
        77: 'Snow Grains',
        80: 'Slight Rain Showers',
        81: 'Moderate Rain Showers',
        82: 'Violent Rain Showers',
        85: 'Slight Snow Showers',
        86: 'Heavy Snow Showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with Slight Hail',
        99: 'Thunderstorm with Heavy Hail'
      };
      
      const condition = weatherConditions[current.weather_code as number] || 'Unknown';
      
      response.setSuccess({
        city: name,
        temperature: Math.round(current.temperature_2m),
        condition: condition,
        humidity: current.relative_humidity_2m,
        wind: `${Math.round(current.wind_speed_10m)} mph`,
        timestamp: new Date().toISOString(),
        source: "Open-Meteo API"
      });
    } catch (error: unknown) {
      console.error("Weather API error:", error);
      const nodeError = new GlobalError((error as Error).message);
      nodeError.setCode(500);
      nodeError.setStack((error as Error).stack);
      nodeError.setName(this.name);
      
      response.setError(nodeError);
    }

    return response;
  }
} 