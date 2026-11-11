import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import RandomForestClassifier
import joblib

# Create fake data
df = pd.DataFrame({
    'neighbourhood_group': ['Manhattan', 'Brooklyn', 'Queens', 'Manhattan', 'Brooklyn'],
    'neighbourhood': ['Midtown', 'Williamsburg', 'Astoria', 'Harlem', 'Bushwick'],
    'latitude': [40.75, 40.71, 40.76, 40.81, 40.70],
    'longitude': [-73.98, -73.95, -73.92, -73.94, -73.93],
    'price': [150, 85, 60, 200, 90],
    'minimum_nights': [1, 2, 3, 1, 2],
    'number_of_reviews': [10, 25, 5, 50, 12],
    'reviews_per_month': [1.5, 2.0, 0.5, 4.1, 1.2],
    'calculated_host_listings_count': [1, 2, 1, 5, 1],
    'availability_365': [30, 100, 200, 10, 50],
    'room_type': ['Entire home/apt', 'Private room', 'Private room', 'Entire home/apt', 'Private room']
})

X = df[['neighbourhood_group', 'neighbourhood', 'latitude', 'longitude',
        'price', 'minimum_nights', 'number_of_reviews',
        'reviews_per_month', 'calculated_host_listings_count',
        'availability_365']]
y = df['room_type']

# Identify which columns are text (categorical) and which are numbers
categorical_cols = ['neighbourhood_group', 'neighbourhood']

# Preprocessor to handle text columns using OneHotEncoder
preprocessor = ColumnTransformer(
    transformers=[
        ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_cols)
    ],
    remainder='passthrough' # Keeps numerical columns as they are
)

# Combine preprocessor and model into a single pipeline
model_pipeline = Pipeline([
    ('preprocessor', preprocessor),
    ('classifier', RandomForestClassifier())
])

model_pipeline.fit(X, y)

# Save the working pipeline
joblib.dump(model_pipeline, "Model_Pipeline.pkl")
print("Success! Model_Pipeline.pkl has been created successfully.")