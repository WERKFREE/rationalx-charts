import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
import os

# Pfade
DATA_DIR = "../Data"
EXPORT_DIR = "../Charts"
os.makedirs(EXPORT_DIR, exist_ok=True)

# CSV laden
df = pd.read_csv(os.path.join(DATA_DIR, "gdppercapita.csv"))

# Nur ein Land auswählen (z. B. Germany)
country = "Germany"
df_country = df[df["Country Name"] == country]

# Daten umformen: von wide → long
df_long = df_country.melt(
    id_vars=["Country Name", "Country Code", "Indicator Name", "Indicator Code"],
    var_name="Year",
    value_name="Value"
)

# Nur Jahre behalten (Zahlen als Strings filtern)
df_long = df_long[df_long["Year"].str.isdigit()]
df_long["Year"] = df_long["Year"].astype(int)
df_long = df_long.sort_values("Year")

# Plot
fig, ax = plt.subplots()
line, = ax.plot([], [], lw=2)

ax.set_xlim(df_long["Year"].min(), df_long["Year"].max())
ax.set_ylim(0, df_long["Value"].max() * 1.1)

def init():
    line.set_data([], [])
    return line,

def update(frame):
    x = df_long["Year"][:frame]
    y = df_long["Value"][:frame]
    line.set_data(x, y)
    return line,

ani = FuncAnimation(fig, update, frames=len(df_long), init_func=init, blit=True)

# Export
export_path = os.path.join(EXPORT_DIR, f"gdp_{country}.mp4")
ani.save(export_path, writer="ffmpeg", fps=2)
print(f"✅ Export fertig: {export_path}")
