# ml-rsi.pine README

Introducing the Machine Learning RSI with KNN Adaptation - a cutting-edge momentum indicator that blends the classic Relative Strength Index (RSI) with machine learning principles. By leveraging K-Nearest Neighbors (KNN), this indicator aims at identifying historical patterns that resemble current market behaviours and uses this context to refine RSI readings with enhanced sensitivity and responsiveness.

Unlike traditional RSI models, which treat every market environment the same, this version adapts in real-time based on how similar past conditions evolved, offering an analytical edge without relying on predictive assumptions.

## Key Features

### 🔁 KNN-Based RSI Refinement

This indicator uses a machine learning algorithm (K-Nearest Neighbors) to compare current RSI and price action characteristics to similar historical conditions. The resulting RSI is weighted accordingly, producing a dynamically adjusted value that reflects historical context.

### 📈 Multi-Feature Similarity Analysis

Pattern similarity is calculated using up to five customizable features:

- RSI level
- RSI momentum
- Volatility
- Linear regression slope
- Price momentum

Users can adjust how many features are used to tailor the behaviour of the KNN logic.

### 🧠 Machine Learning Weight Control

The influence of the machine learning model on the final RSI output can be fine-tuned using a simple slider. This lets you blend traditional RSI and machine learning-enhanced RSI to suit your preferred level of adaptation.

### 🎛️ Adaptive Filtering

Additional smoothing options (Kalman Filter, ALMA, Double EMA) can be applied to the RSI, offering better visual clarity and helping to reduce noise in high-frequency environments.

## How It Works

### Similarity Matching with KNN

At each candle, the current RSI and optional market characteristics are compared to historical bars using a KNN search. The algorithm selects the closest matches and averages their RSI values, weighted by similarity. The more similar the pattern, the greater its influence.

### Feature-Based Weighting

Similarity is determined using normalized values of the selected features, which gives a more refined result than RSI alone. You can choose to use only 1 (RSI) or up to all 5 features for deeper analysis.

### Filtering & Blending

After the machine learning-enhanced RSI is calculated, it can be optionally smoothed using advanced filters to suppress short-term noise or sharp spikes. This makes it easier to evaluate RSI signals in different volatility regimes.

### Parameters Explained

### 📊 RSI Settings

Set the base RSI length and select your preferred smoothing method from 10+ moving average types (e.g., EMA, ALMA, TEMA).

### 🧠 Machine Learning Controls

- Enable or disable the KNN engine
- Select how many nearest neighbors to compare (K)
- Choose the number of features used in similarity detection
- Control how much the machine learning engine affects the RSI calculation

### 🔍 Filtering Options

Enable one of several advanced smoothing techniques (Kalman Filter, ALMA, Double EMA) to adjust the indicator's reactivity and stability.

### 📏 Threshold Levels

Define static overbought/oversold boundaries or reference dynamically adjusted thresholds based on historical context identified by the KNN algorithm.

### 🎨 Visual Enhancements

Select between trend-following or impulse colouring styles. Customize color palettes to accommodate different types of color blindness. Enable neon-style effects for visual clarity.

## Use Cases

Swing & Trend Traders
Can use the indicator to explore how current RSI readings compare to similar market phases, helping to assess trend strength or potential turning points.

Intraday Traders
Benefit from adjustable filters and fast-reacting smoothing to reduce noise in shorter timeframes while retaining contextual relevance.

Discretionary Analysts
Use the adaptive OB/OS thresholds and visual cues to supplement broader confluence zones or market structure analysis.

## Customisation Tips

Higher Volatility Periods: Use more neighbors and enable filtering to reduce noise.

Lower Volatility Markets: Use fewer features and disable filtering for quicker RSI adaptation.

Deeper Contextual Analysis: Increase KNN lookback and raise the feature count to refine pattern recognition.

Accessibility Needs: Switch to Deuteranopia or Monochrome mode for clearer visuals in specific color vision conditions.

## Final Thoughts

The Machine Learning RSI combines familiar momentum logic with statistical context derived from historical similarity analysis. It does not attempt to predict price action but rather contextualizes RSI behaviour with added nuance. This makes it a valuable tool for those looking to elevate traditional RSI workflows with adaptive, research-driven enhancements.
